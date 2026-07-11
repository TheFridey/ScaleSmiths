import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildForgeWorkspaceSlug } from "@/lib/forge-workspace"
import { FORGE_GENERATED_CODE_ARTIFACT_TITLE, readForgeGeneratedCodeArtifact } from "@/lib/forge-frontend-code"
import { FORGE_QA_ARTIFACT_TITLE, readForgeQaArtifact } from "@/lib/forge-qa"
import { FORGE_VISUAL_QA_ARTIFACT_TITLE, readForgeVisualQaArtifact } from "@/lib/forge-visual-qa"
import { forgeExportFilename } from "@/lib/forge-export"
import {
  FORGE_DEPLOY_ARTIFACT_KIND,
  FORGE_DEPLOY_ARTIFACT_TITLE,
  buildForgeDeployChecklist,
  buildForgeDeploymentNotesContent,
  buildForgeDeploymentPlan,
  evaluateForgeDeployReadiness,
  isForgeDeployMethod,
  parseForgeDeployConfirmations,
  readForgeDeploymentArtifact,
  type ForgeDeployConfirmations,
  type ForgeDeployContext,
  type ForgeDeployLifecycle,
  type ForgeDeployMethod,
  type ForgeDeploySignals,
  type ForgeDeploymentNotes,
} from "@/lib/forge-deploy"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeIntegrationConfigs, forgeMemories, forgeProjects } from "@/lib/schema"
import { forgeTasks } from "@/lib/schema"
import { taskBlocksDeployment } from "@/lib/forge-task-quality"
import { evaluatePersistedProjectTransition, workflowAuditMetadata } from "./forge-workflow"

export class ForgeDeployError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeDeployError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export type ForgeDeployAction = "prepare" | "update_checklist" | "mark_ready" | "mark_deployed"

export interface ForgeDeployRequest {
  action: ForgeDeployAction
  method?: ForgeDeployMethod
  confirmations?: Partial<ForgeDeployConfirmations>
}

export async function runForgeDeployAgent(projectId: number, actor: string, request: ForgeDeployRequest) {
  const context = await loadDeployContext(projectId)
  const { project } = context

  if (project.status === "archived") throw new ForgeDeployError("Archived Forge projects cannot be deployed.", 400)

  switch (request.action) {
    case "prepare": return prepare(context, actor, request)
    case "update_checklist": return updateChecklist(context, actor, request)
    case "mark_ready": return markReady(context, actor)
    case "mark_deployed": return markDeployed(context, actor)
    default: throw new ForgeDeployError("Unknown deployment action.", 400)
  }
}

type DeployContext = Awaited<ReturnType<typeof loadDeployContext>>

async function prepare(context: DeployContext, actor: string, request: ForgeDeployRequest) {
  if (!context.signals.hasGeneratedSite) throw new ForgeDeployError("Generate the site before preparing a deployment.", 400)

  const method: ForgeDeployMethod = isForgeDeployMethod(request.method) ? request.method : context.existing.method
  const confirmations = mergeConfirmations(context.existing.confirmations, request.confirmations)
  const notes = composeNotes(context, method, confirmations, context.existing.lifecycle, context.existing.notes)

  const artifact = await persistNotes(context.project.id, notes, actor, "deploy_prepared", `Prepared ${methodLabelFor(method)} deployment for ${context.project.name}.`)
  return { ok: true as const, artifactId: artifact.id, notes }
}

async function updateChecklist(context: DeployContext, actor: string, request: ForgeDeployRequest) {
  const method = context.existing.method
  const confirmations = mergeConfirmations(context.existing.confirmations, request.confirmations)
  const notes = composeNotes(context, method, confirmations, context.existing.lifecycle, context.existing.notes)

  const artifact = await persistNotes(context.project.id, notes, actor, "deploy_checklist_updated", `Updated deployment checklist for ${context.project.name}.`)
  return { ok: true as const, artifactId: artifact.id, notes }
}

async function markReady(context: DeployContext, actor: string) {
  const transition = await evaluatePersistedProjectTransition({ projectId: context.project.id, to: "ready_to_deploy" })
  if (!context.signals.hasGeneratedSite) throw new ForgeDeployError("Generate the site before marking it ready to deploy.", 400)
  if (context.qualityBlockers.length) throw new ForgeDeployError(`Deployment blocked by unapproved task quality: ${context.qualityBlockers.join(", ")}.`, 400)

  const method = context.existing.method
  const confirmations = context.existing.confirmations
  const checklist = buildForgeDeployChecklist(context.signals, confirmations)
  const readiness = evaluateForgeDeployReadiness(checklist)

  if (!readiness.ready) {
    const blockers = [...readiness.failed, ...readiness.pending].join(", ")
    throw new ForgeDeployError(`Deployment checklist is not complete. Outstanding: ${blockers}.`, 400)
  }

  const now = new Date()
  const notes = composeNotes(context, method, confirmations, "ready", context.existing.notes, { readyAt: now.toISOString() })

  const artifact = await db.transaction(async (tx) => {
    const saved = await persistNotesTx(tx, context.project.id, notes)
    await tx.update(forgeProjects).set({ status: "ready_to_deploy", updatedAt: now }).where(eq(forgeProjects.id, context.project.id))
    await tx.insert(forgeActivityLogs).values({
      projectId: context.project.id,
      actor,
      action: "deploy_marked_ready",
      message: `Marked ${context.project.name} ready to deploy (${methodLabelFor(method)}).`,
      metadataJson: { artifactId: saved.id, method },
    })
    await tx.insert(forgeActivityLogs).values({
      projectId: context.project.id,
      actor,
      action: "deployment_status_changed",
      message: `Deployment status changed to ready for ${context.project.name}.`,
      metadataJson: { artifactId: saved.id, method, status: "ready", ...workflowAuditMetadata(transition, now) },
    })
    return saved
  })

  return { ok: true as const, artifactId: artifact.id, notes }
}

async function markDeployed(context: DeployContext, actor: string) {
  const transition = await evaluatePersistedProjectTransition({ projectId: context.project.id, to: "deployed" })
  if (context.qualityBlockers.length) throw new ForgeDeployError(`Deployment blocked by unapproved task quality: ${context.qualityBlockers.join(", ")}.`, 400)
  if (context.project.status !== "ready_to_deploy" && context.existing.lifecycle !== "ready") {
    throw new ForgeDeployError("Mark the project ready to deploy before marking it deployed.", 400)
  }

  const method = context.existing.method
  const confirmations = context.existing.confirmations
  const now = new Date()
  const notes = composeNotes(context, method, confirmations, "deployed", context.existing.notes, {
    readyAt: context.existing.notes?.readyAt ?? now.toISOString(),
    deployedAt: now.toISOString(),
  })

  const artifact = await db.transaction(async (tx) => {
    const saved = await persistNotesTx(tx, context.project.id, notes)
    await tx.update(forgeProjects).set({ status: "deployed", updatedAt: now }).where(eq(forgeProjects.id, context.project.id))
    await tx.insert(forgeActivityLogs).values({
      projectId: context.project.id,
      actor,
      action: "deploy_marked_deployed",
      message: `Marked ${context.project.name} as deployed (${methodLabelFor(method)}).`,
      metadataJson: { artifactId: saved.id, method },
    })
    await tx.insert(forgeActivityLogs).values({
      projectId: context.project.id,
      actor,
      action: "deployment_status_changed",
      message: `Deployment status changed to deployed for ${context.project.name}.`,
      metadataJson: { artifactId: saved.id, method, status: "deployed", ...workflowAuditMetadata(transition, now) },
    })
    return saved
  })

  return { ok: true as const, artifactId: artifact.id, notes }
}

/* ── composition ────────────────────────────────────────────────────── */

function composeNotes(
  context: DeployContext,
  method: ForgeDeployMethod,
  confirmations: ForgeDeployConfirmations,
  lifecycle: ForgeDeployLifecycle,
  previous: ForgeDeploymentNotes | null,
  timestamps: { readyAt?: string; deployedAt?: string } = {},
): ForgeDeploymentNotes {
  const checklist = buildForgeDeployChecklist(context.signals, confirmations)
  const readiness = evaluateForgeDeployReadiness(checklist)
  const plan = buildForgeDeploymentPlan(method, context.deployContext)

  return {
    kind: FORGE_DEPLOY_ARTIFACT_KIND,
    method,
    lifecycle,
    plan,
    checklist,
    confirmations,
    readiness,
    readyAt: timestamps.readyAt ?? previous?.readyAt ?? null,
    deployedAt: timestamps.deployedAt ?? previous?.deployedAt ?? null,
    generatedAt: new Date().toISOString(),
  }
}

function mergeConfirmations(existing: ForgeDeployConfirmations, incoming: Partial<ForgeDeployConfirmations> | undefined): ForgeDeployConfirmations {
  if (!incoming) return existing
  return parseForgeDeployConfirmations({ ...existing, ...incoming })
}

function methodLabelFor(method: ForgeDeployMethod): string {
  return method === "vps" ? "VPS package" : method === "github" ? "GitHub (placeholder)" : "manual"
}

/* ── persistence ────────────────────────────────────────────────────── */

async function persistNotes(projectId: number, notes: ForgeDeploymentNotes, actor: string, action: string, message: string) {
  return db.transaction(async (tx) => {
    const saved = await persistNotesTx(tx, projectId, notes)
    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action,
      message,
      metadataJson: { artifactId: saved.id, method: notes.method, ready: notes.readiness.ready },
    })
    return saved
  })
}

async function persistNotesTx(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], projectId: number, notes: ForgeDeploymentNotes) {
  const content = buildForgeDeploymentNotesContent(notes)
  const [existing] = await tx.select().from(forgeArtifacts).where(and(
    eq(forgeArtifacts.projectId, projectId),
    eq(forgeArtifacts.type, "deployment_notes"),
    eq(forgeArtifacts.title, FORGE_DEPLOY_ARTIFACT_TITLE),
  )).limit(1)

  const metadataJson = {
    ...(existing?.metadataJson ?? {}),
    kind: FORGE_DEPLOY_ARTIFACT_KIND,
    notes,
  }

  const now = new Date()
  const [artifact] = existing
    ? await tx.update(forgeArtifacts).set({ content, metadataJson, updatedAt: now }).where(eq(forgeArtifacts.id, existing.id)).returning()
    : await tx.insert(forgeArtifacts).values({
      projectId,
      type: "deployment_notes",
      title: FORGE_DEPLOY_ARTIFACT_TITLE,
      content,
      metadataJson,
      updatedAt: now,
    }).returning()

  return artifact
}

/* ── context ────────────────────────────────────────────────────────── */

async function loadDeployContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeDeployError("Forge project not found.", 404)

    const [workspaceMemories, generatedCodeArtifacts, qaArtifacts, visualQaArtifacts, deployArtifacts, integrations, qualityTasks] = await Promise.all([
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(
      eq(forgeMemories.projectId, projectId),
      eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "generated_code"),
      eq(forgeArtifacts.title, FORGE_GENERATED_CODE_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "qa_report"),
      eq(forgeArtifacts.title, FORGE_QA_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "visual_qa"),
      eq(forgeArtifacts.title, FORGE_VISUAL_QA_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "deployment_notes"),
      eq(forgeArtifacts.title, FORGE_DEPLOY_ARTIFACT_TITLE),
    )).limit(1),
      db.select({
      provider: forgeIntegrationConfigs.provider,
      enabled: forgeIntegrationConfigs.enabled,
      }).from(forgeIntegrationConfigs).where(eq(forgeIntegrationConfigs.projectId, projectId)),
      db.select({ id: forgeTasks.id, title: forgeTasks.title, status: forgeTasks.status, resultQuality: forgeTasks.resultQuality, humanApprovalRequired: forgeTasks.humanApprovalRequired, qualityApprovedAt: forgeTasks.qualityApprovedAt, qualityApprovalReason: forgeTasks.qualityApprovalReason })
        .from(forgeTasks).where(eq(forgeTasks.projectId, projectId)),
  ])

  const generated = readForgeGeneratedCodeArtifact(generatedCodeArtifacts[0]?.metadataJson)
  const qa = readForgeQaArtifact(qaArtifacts[0]?.metadataJson)
  const visualQa = readForgeVisualQaArtifact(visualQaArtifacts[0]?.metadataJson)
  const existing = readForgeDeploymentArtifact(deployArtifacts[0]?.metadataJson)
  const workspace = readForgeWorkspaceMemory(workspaceMemories[0]?.value)
  const enabled = (provider: string) => integrations.some((integration) => integration.provider === provider && integration.enabled)

  const signals: ForgeDeploySignals = {
    hasGeneratedSite: generated.status === "generated",
    qaStatus: qa.report ? qa.status : null,
    lighthouseStatus: visualQa.report ? visualQa.status : null,
    resendEnabled: enabled("resend"),
    whatsappEnabled: enabled("whatsapp"),
    analyticsEnabled: enabled("analytics"),
  }

  const slug = workspace?.slug ?? buildForgeWorkspaceSlug({ id: project.id, name: project.name, businessName: project.businessName })
  const deployContext: ForgeDeployContext = {
    businessName: project.businessName || project.name,
    slug,
    workspacePath: workspace?.relativePath ?? null,
    exportZipName: forgeExportFilename("site", project.businessName || project.name),
  }

    return {
      project,
      qualityBlockers: qualityTasks.filter(taskBlocksDeployment).map((task) => `#${task.id} ${task.title}`),
    signals,
    deployContext,
    existing: {
      method: existing.method,
      confirmations: existing.confirmations,
      lifecycle: existing.lifecycle,
      notes: existing.notes,
    },
  }
}
