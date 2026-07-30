import "server-only"
import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildForgeIntakeSummary, FORGE_INTAKE_SECTIONS, getForgeIntakeMissingFields } from "@/lib/forge"
import { applyForgeInterpretationSummary, forgeIntakeSubmissionKey, type ForgeIntakeInterpretation } from "@/lib/forge-project-intake"
import { forgeActivityLogs, forgeArtifacts, forgeProjects } from "@/lib/schema"
import { approveForgeRunStep, createForgeRun, startForgeRun } from "./forge-run-orchestrator"

export async function approveUnifiedForgeIntake(body: Record<string, unknown>, actor: string) {
  const raw = body.interpretation
  const summary = body.summary
  if (!isInterpretation(raw) || !isSummary(summary)) return Response.json({ error: "The generated interpretation is invalid. Generate it again before approval." }, { status: 400 })
  const interpretation = applyForgeInterpretationSummary(raw, summary)
  if (interpretation.missingCritical.length) {
    return Response.json({ error: "Resolve the remaining critical questions before starting the build.", code: "critical_information_missing", missingCritical: interpretation.missingCritical }, { status: 400 })
  }
  const submissionKey = typeof body.submissionKey === "string" && /^[a-f0-9-]{16,100}$/i.test(body.submissionKey)
    ? body.submissionKey
    : forgeIntakeSubmissionKey(interpretation, actor)

  const project = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${submissionKey}))`)
    const [existingActivity] = await tx.select({ projectId: forgeActivityLogs.projectId }).from(forgeActivityLogs)
      .where(and(eq(forgeActivityLogs.action, "forge_intake_created"), sql`${forgeActivityLogs.metadataJson}->>'submissionKey' = ${submissionKey}`))
      .orderBy(desc(forgeActivityLogs.createdAt)).limit(1)
    if (existingActivity?.projectId) {
      const [existingProject] = await tx.select().from(forgeProjects).where(eq(forgeProjects.id, existingActivity.projectId)).limit(1)
      if (existingProject) return existingProject
    }

    const deadline = interpretation.project.deadline ? new Date(interpretation.project.deadline) : null
    if (deadline && Number.isNaN(deadline.getTime())) throw new Error("Deadline is invalid.")
    const [created] = await tx.insert(forgeProjects).values({
      name: interpretation.project.name,
      businessName: interpretation.project.businessName,
      industry: interpretation.project.industry || null,
      websiteUrl: interpretation.project.websiteUrl || null,
      targetAudience: interpretation.project.targetAudience || null,
      primaryGoal: interpretation.project.primaryGoal || null,
      budgetRange: interpretation.project.budgetRange || null,
      deadline,
      brandNotes: interpretation.project.brandNotes || null,
      priority: interpretation.project.priority,
      status: "intake",
      ownerActor: actor,
      updatedAt: new Date(),
    }).returning()
    const missingFields = getForgeIntakeMissingFields(interpretation.intake)
    const requiredCount = FORGE_INTAKE_SECTIONS.reduce((sum, section) => sum + section.fields.filter((field) => field.required).length, 0)
    const completenessScore = Math.round(((requiredCount - missingFields.length) / requiredCount) * 100)
    const now = new Date()
    const [artifact] = await tx.insert(forgeArtifacts).values({
      projectId: created.id,
      type: "handover_doc",
      title: "Intake Summary",
      content: buildForgeIntakeSummary(interpretation.intake, completenessScore, missingFields),
      metadataJson: {
        kind: "forge_intake", status: "completed", intake: interpretation.intake, buildBrief: interpretation.buildBrief,
        interpretation: interpretation.summary, confirmedFields: interpretation.confirmedFields, assumedFields: interpretation.assumedFields,
        confidenceNotes: interpretation.confidenceNotes, strategyPack: interpretation.strategyPack, uploadedAssets: interpretation.assets,
        completenessScore, missingFields, completedAt: now.toISOString(),
      },
      qualityState: "validated",
      approvalState: "approved",
      approvalHistory: [{ actor, reason: "Approved through unified Forge intake.", at: now.toISOString() }],
      actor,
      outputHash: submissionKey,
      updatedAt: now,
    }).returning()
    await tx.insert(forgeActivityLogs).values({
      projectId: created.id,
      actor,
      action: "forge_intake_created",
      message: `Created ${created.name} from the approved unified intake.`,
      metadataJson: { submissionKey, artifactId: artifact.id, strategyPack: interpretation.strategyPack.id },
    })
    return created
  })

  const mode = interpretation.summary.projectType === "migration" ? "migration" : interpretation.summary.projectType === "redesign" ? "refresh" : "standard"
  const runResult = await createForgeRun({ projectId: project.id, actor, mode })
  if (!runResult) throw new Error("Forge created the project but could not create its production run.")
  const runId = runResult.id
  let run = runResult
  if (run.status === "draft" || run.status === "paused") {
    const started = await startForgeRun(runId, actor)
    if (!started) throw new Error("Forge created the run but could not start it.")
    run = started
  }
  const brief = run?.steps.find((step) => step.stage === "brief")
  if (brief?.status === "awaiting_approval") {
    const approved = await approveForgeRunStep(runId, "brief", actor, "Approved through unified Forge project intake.")
    if (!approved) throw new Error("Forge started the run but could not record brief approval.")
    run = approved
  }
  return Response.json({ ok: true, project, run, redirectTo: `/forge/${project.id}?view=overview&run=${runId}` }, { status: 201 })
}

function isInterpretation(value: unknown): value is ForgeIntakeInterpretation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Partial<ForgeIntakeInterpretation>
  if (!record.project || !record.intake || !record.summary || !record.buildBrief || !Array.isArray(record.missingCritical)) return false
  if (!Object.values(record.project).every((item) => typeof item === "string" || item === "low" || item === "medium" || item === "high")) return false
  if (!Object.values(record.intake).every((item) => typeof item === "string" && item.length <= 20_000)) return false
  if (!Array.isArray(record.assets) || record.assets.length > 10) return false
  const totalBytes = record.assets.reduce((sum, asset) => sum + (typeof asset.size === "number" ? asset.size : Number.POSITIVE_INFINITY), 0)
  return totalBytes <= 3_000_000 && record.assets.every((asset) => typeof asset.name === "string" && asset.name.length <= 180 && (!asset.dataUrl || asset.dataUrl.length <= 2_700_000))
}

function isSummary(value: unknown): value is ForgeIntakeInterpretation["summary"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return ["business", "projectType", "primaryOutcome", "targetAudience", "proposedPages", "requiredFunctionality", "designDirection", "integrations", "contentAssumptions", "exclusions", "openQuestions"]
    .every((key) => typeof record[key] === "string")
}
