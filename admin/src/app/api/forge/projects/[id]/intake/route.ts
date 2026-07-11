import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { auth } from "../../../../../../../auth"
import { db } from "@/lib/db"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { forgeActivityLogs, forgeArtifacts, forgeProjects } from "@/lib/schema"
import {
  FORGE_INTAKE_ARTIFACT_KIND,
  FORGE_INTAKE_SECTIONS,
  FORGE_INTAKE_ARTIFACT_TITLE,
  buildForgeIntakeSummary,
  getForgeIntakeMissingFields,
  parseForgeIntakePayload,
  readForgeIntakeArtifact,
  type ForgeIntakeData,
} from "@/lib/forge"
import {
  FORGE_BUILD_BRIEF_QUESTION_SCHEMA,
  applyForgeBuildBriefAnswer,
  briefQuestionIdFromAi,
  buildForgeBuildBriefAiPrompt,
  createForgeBuildBriefFromPrompt,
  fallbackForgeBuildBriefQuestion,
  finalizeForgeBuildBriefIntake,
  readForgeBuildBriefState,
  type ForgeBuildBriefQuestionResponse,
  type ForgeBuildBriefState,
} from "@/lib/forge-intake-brief"
import { ForgeAiError, runForgeAiJson } from "@/lib/server/forge-ai"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const [project] = await db.select({ id: forgeProjects.id }).from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  }

  const [artifact] = await db
    .select()
    .from(forgeArtifacts)
    .where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "handover_doc"),
      eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
    ))
    .limit(1)

  const intake = readForgeIntakeArtifact(artifact?.metadataJson)
  return NextResponse.json({ intake: { ...intake, buildBrief: readForgeBuildBriefState(artifact?.metadataJson) } })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid intake payload." }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const action = input.action === "complete" ? "complete" : "save"

  if (input.mode === "brief_start" || input.mode === "brief_answer" || input.mode === "brief_generate") {
    return handleBriefMode({
      input,
      mode: input.mode,
      projectId,
      actor: sessionActor(session),
    })
  }

  const parsed = parseForgeIntakePayload(input)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  if (action === "complete" && parsed.data.missingFields.length > 0) {
    return NextResponse.json({
      error: "Complete the missing intake fields before marking this intake complete.",
      missingFields: parsed.data.missingFields,
      completenessScore: parsed.data.completenessScore,
    }, { status: 400 })
  }

  const [project] = await db.select({ id: forgeProjects.id, name: forgeProjects.name }).from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  }

  const [existing] = await db
    .select({ metadataJson: forgeArtifacts.metadataJson })
    .from(forgeArtifacts)
    .where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "handover_doc"),
      eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
    ))
    .limit(1)
  const artifact = await saveIntakeArtifact({
    projectId,
    projectName: project.name,
    actor: sessionActor(session),
    intake: parsed.data.intake,
    status: action === "complete" ? "completed" : "draft",
    buildBrief: readForgeBuildBriefState(existing?.metadataJson),
    activityAction: action === "complete" ? "intake_complete" : "intake_save",
    activityMessage: action === "complete"
      ? `Completed structured intake for ${project.name}.`
      : `Saved structured intake draft for ${project.name}.`,
  })

  return NextResponse.json({
    ok: true,
    artifact,
    intake: {
      intake: parsed.data.intake,
      completenessScore: parsed.data.completenessScore,
      missingFields: parsed.data.missingFields,
      status: action === "complete" ? "completed" : "draft",
      buildBrief: readForgeBuildBriefState(existing?.metadataJson),
    },
  })
}

async function handleBriefMode({
  input,
  mode,
  projectId,
  actor,
}: {
  input: Record<string, unknown>
  mode: "brief_start" | "brief_answer" | "brief_generate"
  projectId: number
  actor: string
}) {
  const [project] = await db
    .select({
      id: forgeProjects.id,
      name: forgeProjects.name,
      businessName: forgeProjects.businessName,
      industry: forgeProjects.industry,
      websiteUrl: forgeProjects.websiteUrl,
      targetAudience: forgeProjects.targetAudience,
      primaryGoal: forgeProjects.primaryGoal,
    })
    .from(forgeProjects)
    .where(eq(forgeProjects.id, projectId))
    .limit(1)

  if (!project) {
    return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  }

  const [existing] = await db
    .select()
    .from(forgeArtifacts)
    .where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "handover_doc"),
      eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
    ))
    .limit(1)

  let intake = readForgeIntakeArtifact(existing?.metadataJson).intake
  let buildBrief = readForgeBuildBriefState(existing?.metadataJson)

  if (mode === "brief_start") {
    const prompt = typeof input.prompt === "string" ? input.prompt : ""
    const created = createForgeBuildBriefFromPrompt({ prompt, project })
    intake = { ...intake, ...Object.fromEntries(Object.entries(created.intake).filter(([, value]) => value.trim())) } as ForgeIntakeData
    buildBrief = created.state
  } else if (mode === "brief_answer") {
    const answer = typeof input.answer === "string" ? input.answer : ""
    const applied = applyForgeBuildBriefAnswer({ state: buildBrief, intake, answer })
    intake = applied.intake
    buildBrief = applied.state
  } else {
    intake = finalizeForgeBuildBriefIntake(intake)
    buildBrief = { ...buildBrief, currentQuestionId: null, updatedAt: new Date().toISOString() }
  }

  if (mode !== "brief_generate") {
    const aiQuestion = await generateBriefQuestion({ intake, buildBrief, project })
    buildBrief = {
      ...buildBrief,
      currentQuestionId: aiQuestion.questionId,
      messages: replaceLastAssistantQuestion(buildBrief.messages, aiQuestion.question, aiQuestion.questionId),
      updatedAt: new Date().toISOString(),
    }
  }

  const status = mode === "brief_generate" ? "completed" : "draft"
  const artifact = await saveIntakeArtifact({
    projectId,
    projectName: project.name,
    actor,
    intake,
    status,
    buildBrief,
    activityAction: mode === "brief_generate" ? "intake_complete" : "intake_brief_update",
    activityMessage: mode === "brief_generate"
      ? `Generated a structured intake from the guided brief for ${project.name}.`
      : `Updated guided intake brief for ${project.name}.`,
  })
  const missingFields = getForgeIntakeMissingFields(intake)
  const requiredCount = requiredIntakeCount()
  const completenessScore = Math.round(((requiredCount - missingFields.length) / requiredCount) * 100)

  return NextResponse.json({
    ok: true,
    artifact,
    intake: {
      intake,
      completenessScore,
      missingFields,
      status,
      buildBrief,
    },
  })
}

async function generateBriefQuestion({
  intake,
  buildBrief,
  project,
}: {
  intake: ForgeIntakeData
  buildBrief: ForgeBuildBriefState
  project: { name: string; businessName: string; industry: string | null; targetAudience: string | null; primaryGoal: string | null }
}) {
  const fallback = fallbackForgeBuildBriefQuestion(intake, buildBrief)

  try {
    const result = await runForgeAiJson<ForgeBuildBriefQuestionResponse>({
      ...getForgeAgentRegistryReference("intake_question"),
      taskType: "planning",
      schemaName: "forge_build_brief_question",
      schema: FORGE_BUILD_BRIEF_QUESTION_SCHEMA,
      systemPrompt: "You are the ScaleSmiths Forge intake guide. Ask one focused build-brief question at a time.",
      prompt: buildForgeBuildBriefAiPrompt({ intake, state: buildBrief, project }),
      maxTokens: 700,
      timeoutMs: 18_000,
      maxRetries: 1,
      projectId: project.name ? null : null,
      mockData: fallback,
    })
    return normalizeBriefQuestionResponse(result.data)
  } catch (error) {
    if (error instanceof ForgeAiError) return normalizeBriefQuestionResponse(fallback)
    throw error
  }
}

function normalizeBriefQuestionResponse(response: ForgeBuildBriefQuestionResponse) {
  return {
    ...response,
    questionId: briefQuestionIdFromAi(response.questionId),
  }
}

async function saveIntakeArtifact({
  projectId,
  projectName,
  actor,
  intake,
  status,
  buildBrief,
  activityAction,
  activityMessage,
}: {
  projectId: number
  projectName: string
  actor: string
  intake: ForgeIntakeData
  status: "draft" | "completed"
  buildBrief: ForgeBuildBriefState
  activityAction: string
  activityMessage: string
}) {
  const missingFields = getForgeIntakeMissingFields(intake)
  const requiredCount = requiredIntakeCount()
  const completenessScore = Math.round(((requiredCount - missingFields.length) / requiredCount) * 100)
  const summary = buildForgeIntakeSummary(intake, completenessScore, missingFields)
  const now = new Date()
  const metadataJson = {
    kind: FORGE_INTAKE_ARTIFACT_KIND,
    status,
    intake,
    buildBrief,
    completenessScore,
    missingFields,
    supportedAgents: ["research", "sitemap", "copy", "design", "build", "integration"],
    completedAt: status === "completed" ? now.toISOString() : null,
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(forgeArtifacts)
      .where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "handover_doc"),
        eq(forgeArtifacts.title, FORGE_INTAKE_ARTIFACT_TITLE),
      ))
      .limit(1)

    const [saved] = existing
      ? await tx
        .update(forgeArtifacts)
        .set({
          content: summary,
          metadataJson,
          updatedAt: now,
        })
        .where(eq(forgeArtifacts.id, existing.id))
        .returning()
      : await tx
        .insert(forgeArtifacts)
        .values({
          projectId,
          type: "handover_doc",
          title: FORGE_INTAKE_ARTIFACT_TITLE,
          content: summary,
          metadataJson,
          updatedAt: now,
        })
        .returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: activityAction,
      message: activityMessage,
      metadataJson: {
        completenessScore,
        missingFields,
        artifactId: saved.id,
        projectName,
      },
    })

    return saved
  })
}

function requiredIntakeCount() {
  return FORGE_INTAKE_SECTIONS.reduce((sum, section) => sum + section.fields.filter((field) => field.required).length, 0)
}

function replaceLastAssistantQuestion(messages: ForgeBuildBriefState["messages"], body: string, questionId: ForgeBuildBriefState["currentQuestionId"]) {
  const next = [...messages]
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index].role === "assistant") {
      next[index] = { ...next[index], body, questionId }
      return next
    }
  }
  return next
}
