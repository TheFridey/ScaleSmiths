import "server-only"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  FORGE_COMPONENT_SPEC_ARTIFACT_TITLE,
  readForgeComponentSpecArtifact,
} from "@/lib/forge-component-spec"
import { FORGE_COPY_ARTIFACT_TITLE, readForgeCopyDocumentArtifact } from "@/lib/forge-copy"
import { FORGE_DESIGN_ARTIFACT_TITLE, readForgeDesignDirectionArtifact } from "@/lib/forge-design"
import {
  FORGE_GENERATED_CODE_ARTIFACT_TITLE,
  readForgeGeneratedCodeArtifact,
} from "@/lib/forge-frontend-code"
import {
  FORGE_VISUAL_CRITIQUE_ARTIFACT_KIND,
  FORGE_VISUAL_CRITIQUE_ARTIFACT_TITLE,
  FORGE_VISUAL_CRITIQUE_SCHEMA,
  approveForgeVisualCritiqueReport,
  buildForgeVisualCritiqueArtifactContent,
  buildForgeVisualCritiqueReport,
  createMockVisualCritiqueReport,
  forgeVisualCritiqueScoresBelowThreshold,
  parseForgeVisualCritiquePayload,
  readForgeVisualCritiqueArtifact,
  safeForgeVisualCritiqueRecommendations,
  withForgeVisualCritiqueAutoFixes,
  type ForgeVisualCritiqueReport,
} from "@/lib/forge-visual-critique"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"
import { buildForgeTaskOutputMetadata, runForgeAiJson } from "./forge-ai"
import { writeForgeWorkspaceFile } from "./forge-workspace"

export class ForgeVisualCritiqueAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeVisualCritiqueAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function runForgeVisualCritiqueAgent(projectId: number, actor: string) {
  const context = await loadVisualCritiqueContext(projectId)
  const { project, design, copy, spec, generated } = context

  if (project.status === "archived") throw new ForgeVisualCritiqueAgentError("Archived Forge projects cannot run visual critique.", 400)
  if (!design) throw new ForgeVisualCritiqueAgentError("Approve design direction before running visual critique.", 400)
  if (!copy) throw new ForgeVisualCritiqueAgentError("Approve copy before running visual critique.", 400)
  if (!spec) throw new ForgeVisualCritiqueAgentError("Generate and approve the component specification before running visual critique.", 400)
  if (!generated) throw new ForgeVisualCritiqueAgentError("Generate site code before running visual critique.", 400)

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeTasks).values({
      projectId,
      title: "Run visual critique",
      description: "Review generated site metadata against approved design, copy, and component specification before QA.",
      agentType: "qa",
      status: "running",
      inputJson: {
        designStyle: design.designStyleName,
        copyPages: copy.pages.map((page) => page.path),
        componentCount: spec.components.length,
        generatedRoutes: generated.routes,
      },
      startedAt: now,
      updatedAt: now,
    }).returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "visual_critique_running",
      message: `Visual critique started for ${project.name}.`,
      metadataJson: { taskId: created.id },
    })

    return [created]
  })

  try {
    const result = await runForgeAiJson({
      ...getForgeAgentRegistryReference("visual_critique"),
      taskType: "qa",
      schemaName: "forge_visual_critique",
      schema: FORGE_VISUAL_CRITIQUE_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Visual Critique Agent.",
        "Review generated-site metadata against approved design, copy, and component specifications.",
        "Score exactly these dimensions from 0-100: brandFit, visualQuality, ctaRelevance, contentSpecificity, seoAeoQuality, accessibility, mobileReadiness, clientReadiness.",
        "Any score below 75 will trigger automatic improvement, so be honest and evidence-led.",
        "Evaluate visual hierarchy, spacing consistency, CTA prominence, trust placement, section ordering, mobile UX, animation restraint, typography consistency, conversion friction, SEO/AEO quality, accessibility, and client readiness.",
        "Return practical design-review JSON only. Never rewrite the whole site.",
        "Only mark safeAutoFix true for spacing, section_ordering, cta_positioning, or trust_section_placement.",
      ].join(" "),
      prompt: buildVisualCritiquePrompt(context),
      maxTokens: 2200,
      timeoutMs: 45_000,
      maxRetries: 1,
      projectId,
      taskId: task.id,
      mockData: createMockVisualCritiqueReport({ design, copy, spec, generated }),
    })
    const parsed = parseForgeVisualCritiquePayload(result.data)
    if (!parsed.ok) throw new ForgeVisualCritiqueAgentError(parsed.error, 500)

    let report = buildForgeVisualCritiqueReport({ data: parsed.data })
    const completedAt = new Date()
    let artifact = await saveVisualCritiqueReport(projectId, report, task.id, completedAt)
    const aiMetadata = buildForgeTaskOutputMetadata({ ...result, data: report })

    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        status: "completed",
        outputJson: {
          artifactId: artifact.id,
          report,
          ...aiMetadata,
        },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))

      await tx.update(forgeProjects).set({ status: "qa", updatedAt: completedAt }).where(eq(forgeProjects.id, projectId))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "visual_critique_completed",
        message: `Visual critique completed for ${project.name} with score ${report.overallScore}/100.`,
        metadataJson: { taskId: task.id, artifactId: artifact.id, score: report.overallScore, scoresBelow75: forgeVisualCritiqueScoresBelowThreshold(report) },
      })
    })

    const lowScores = forgeVisualCritiqueScoresBelowThreshold(report)
    if (lowScores.length && safeForgeVisualCritiqueRecommendations(report).length) {
      const improved = await applyForgeVisualCritiqueSafeFixes(projectId, actor)
      report = improved.report
      artifact = { ...artifact, id: improved.artifactId }
    }

    return { ok: true as const, taskId: task.id, artifactId: artifact.id, report }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeVisualCritiqueAgentError ? error.safeMessage : "Visual critique failed to run."

    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        status: "failed",
        error: safeMessage,
        outputJson: { error: safeMessage },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "visual_critique_failed",
        message: `Visual critique failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage },
      })
    })

    if (error instanceof ForgeVisualCritiqueAgentError) throw error
    throw new ForgeVisualCritiqueAgentError("Visual critique failed to run.", 500)
  }
}

export async function approveForgeVisualCritique(projectId: number, actor: string) {
  const { project, report, artifactId } = await loadLatestVisualCritique(projectId)
  const approved = approveForgeVisualCritiqueReport(report, actor)
  const artifact = await saveVisualCritiqueReport(projectId, approved, null, new Date(), artifactId)

  await db.insert(forgeActivityLogs).values({
    projectId,
    actor,
    action: "visual_critique_approved",
    message: `Approved visual critique recommendations for ${project.name}.`,
    metadataJson: { artifactId: artifact.id, score: approved.overallScore },
  })

  return { ok: true as const, artifactId: artifact.id, report: approved }
}

export async function applyForgeVisualCritiqueSafeFixes(projectId: number, actor: string) {
  const { project, report, artifactId } = await loadLatestVisualCritique(projectId)
  const { workspace } = await loadVisualCritiqueContext(projectId)
  if (!workspace) throw new ForgeVisualCritiqueAgentError("Create a generated-site workspace before applying critique fixes.", 400)

  const safe = safeForgeVisualCritiqueRecommendations(report)
  if (!safe.length) throw new ForgeVisualCritiqueAgentError("No safe visual critique fixes are available to apply.", 400)

  const applied = safe.map((item) => `${item.safeFixType}: ${item.title}`)
  await writeForgeWorkspaceFile(workspace, "src/lib/visual-critique-overrides.ts", buildVisualCritiqueOverridesFile(report, applied), {
    overwrite: true,
  })

  const updated = withForgeVisualCritiqueAutoFixes(report, applied)
  const artifact = await saveVisualCritiqueReport(projectId, updated, null, new Date(), artifactId)

  await db.insert(forgeActivityLogs).values({
    projectId,
    actor,
    action: "visual_critique_autofix_applied",
    message: `Applied ${applied.length} safe visual critique fix${applied.length === 1 ? "" : "es"} for ${project.name}.`,
    metadataJson: { artifactId: artifact.id, fixes: applied },
  })

  return { ok: true as const, artifactId: artifact.id, report: updated, fixes: applied }
}

async function saveVisualCritiqueReport(projectId: number, report: ForgeVisualCritiqueReport, taskId: number | null, now: Date, existingArtifactId?: number) {
  const content = buildForgeVisualCritiqueArtifactContent(report)
  const [existing] = existingArtifactId
    ? await db.select().from(forgeArtifacts).where(eq(forgeArtifacts.id, existingArtifactId)).limit(1)
    : await db.select().from(forgeArtifacts).where(and(
        eq(forgeArtifacts.projectId, projectId),
        eq(forgeArtifacts.type, "visual_critique"),
        eq(forgeArtifacts.title, FORGE_VISUAL_CRITIQUE_ARTIFACT_TITLE),
      )).limit(1)

  const metadataJson = {
    ...(existing?.metadataJson ?? {}),
    kind: FORGE_VISUAL_CRITIQUE_ARTIFACT_KIND,
    status: report.status,
    report,
    taskId: taskId ?? existing?.metadataJson?.taskId ?? null,
  }

  const [saved] = existing
    ? await db.update(forgeArtifacts).set({ content, metadataJson, updatedAt: now }).where(eq(forgeArtifacts.id, existing.id)).returning()
    : await db.insert(forgeArtifacts).values({
        projectId,
        type: "visual_critique",
        title: FORGE_VISUAL_CRITIQUE_ARTIFACT_TITLE,
        content,
        metadataJson,
        updatedAt: now,
      }).returning()

  return saved
}

async function loadLatestVisualCritique(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeVisualCritiqueAgentError("Forge project not found.", 404)

  const [artifact] = await db.select().from(forgeArtifacts).where(and(
    eq(forgeArtifacts.projectId, projectId),
    eq(forgeArtifacts.type, "visual_critique"),
    eq(forgeArtifacts.title, FORGE_VISUAL_CRITIQUE_ARTIFACT_TITLE),
  )).orderBy(desc(forgeArtifacts.updatedAt)).limit(1)
  const state = readForgeVisualCritiqueArtifact(artifact?.metadataJson)
  if (!artifact || !state.report) throw new ForgeVisualCritiqueAgentError("Run visual critique before approving recommendations.", 400)
  return { project, artifactId: artifact.id, report: state.report }
}

async function loadVisualCritiqueContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeVisualCritiqueAgentError("Forge project not found.", 404)

  const [designArtifact, copyArtifact, specArtifact, generatedArtifact, workspaceMemory] = await Promise.all([
    selectArtifact(projectId, "design_direction", FORGE_DESIGN_ARTIFACT_TITLE),
    selectArtifact(projectId, "copy_doc", FORGE_COPY_ARTIFACT_TITLE),
    selectArtifact(projectId, "component_spec", FORGE_COMPONENT_SPEC_ARTIFACT_TITLE),
    selectArtifact(projectId, "generated_code", FORGE_GENERATED_CODE_ARTIFACT_TITLE),
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY))).limit(1),
  ])

  const design = readForgeDesignDirectionArtifact(designArtifact?.metadataJson).approvedDirection
  const copy = readForgeCopyDocumentArtifact(copyArtifact?.metadataJson).approvedCopy
  const spec = readForgeComponentSpecArtifact(specArtifact?.metadataJson).approvedSpec
  const generated = readForgeGeneratedCodeArtifact(generatedArtifact?.metadataJson).summary
  const workspace = readForgeWorkspaceMemory(workspaceMemory[0]?.value)

  return { project, design, copy, spec, generated, workspace }
}

async function selectArtifact(projectId: number, type: "design_direction" | "copy_doc" | "component_spec" | "generated_code", title: string) {
  const [artifact] = await db.select().from(forgeArtifacts).where(and(
    eq(forgeArtifacts.projectId, projectId),
    eq(forgeArtifacts.type, type),
    eq(forgeArtifacts.title, title),
  )).orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt)).limit(1)
  return artifact ?? null
}

function buildVisualCritiquePrompt(context: Awaited<ReturnType<typeof loadVisualCritiqueContext>>) {
  return [
    "Approved design direction:",
    JSON.stringify(context.design, null, 2),
    "",
    "Approved copy:",
    JSON.stringify({
      summary: context.copy?.copySummary,
      pages: context.copy?.pages.map((page) => ({
        path: page.path,
        h1: page.h1,
        primaryCta: page.primaryCta,
        secondaryCta: page.secondaryCta,
        sectionHeadings: page.sectionHeadings,
        trustProofCopy: page.trustProofCopy,
        serviceDescriptions: page.serviceDescriptions.slice(0, 3),
        localSeoCopy: page.localSeoCopy,
      })),
    }, null, 2),
    "",
    "Generated component specification:",
    JSON.stringify(context.spec, null, 2),
    "",
    "Generated site metadata:",
    JSON.stringify(context.generated, null, 2),
  ].join("\n")
}

function buildVisualCritiqueOverridesFile(report: ForgeVisualCritiqueReport, applied: string[]) {
  return [
    "export const visualCritiqueOverrides = {",
    `  generatedAt: ${JSON.stringify(new Date().toISOString())},`,
    `  overallScore: ${report.overallScore},`,
    "  safeFixes: [",
    ...applied.map((item) => `    ${JSON.stringify(item)},`),
    "  ],",
    "  guidance: {",
    "    spacing: 'Keep section vertical rhythm consistent across proof, services, and CTA blocks.',",
    "    sectionOrdering: 'Keep trust proof directly after the hero before deeper service exploration.',",
    "    ctaPositioning: 'Keep a primary CTA in hero, mid-page proof, and final contact section.',",
    "    trustPlacement: 'Surface local proof, process reassurance, and contact routes before high-friction asks.',",
    "  },",
    "} as const",
    "",
  ].join("\n")
}
