import { assertForgeWorkspaceFileAllowed, normalizeForgeWorkspacePath } from "./forge-workspace"

export const FORGE_GENERATED_SITE_AGENT_VERSION = "2026-07-12.1"
export const FORGE_GENERATED_SITE_AGENT_COMMANDS = [
  "npm run typecheck",
  "npm run lint",
  "npm run build",
] as const

export type ForgeGeneratedSiteAgentCommand = (typeof FORGE_GENERATED_SITE_AGENT_COMMANDS)[number]

export interface ForgeGeneratedSiteChange {
  path: string
  content: string
  reason: string
}

export interface ForgeGeneratedSiteAgentRequest {
  issue: string
  plan: string[]
  affectedFiles: string[]
  changes: ForgeGeneratedSiteChange[]
  commands: string[]
  maxRepairAttempts?: number
  maximumCost?: number
  maximumRuntimeMs?: number
  minimumConfidence?: number
  escalationRule?: string
  repairAttempts?: Array<{ summary: string; changes: ForgeGeneratedSiteChange[]; confidence: number; cost: number }>
}

export type ForgeGeneratedSiteAgentValidation =
  | { ok: true; request: ForgeGeneratedSiteAgentRequest & { commands: ForgeGeneratedSiteAgentCommand[]; maxRepairAttempts: number } }
  | { ok: false; error: string }

export function validateForgeGeneratedSiteAgentRequest(input: ForgeGeneratedSiteAgentRequest): ForgeGeneratedSiteAgentValidation {
  if (!input.issue?.trim()) return { ok: false, error: "A generated-site issue is required." }
  if (!input.plan?.length || input.plan.some((step) => !step.trim())) return { ok: false, error: "A non-empty change plan is required." }
  if (!input.changes?.length) return { ok: false, error: "At least one scoped workspace change is required." }
  if (input.changes.length > 50) return { ok: false, error: "A coding-agent run may modify at most 50 files." }

  const changedPaths = new Set<string>()
  for (const change of input.changes) {
    if (!change.reason?.trim()) return { ok: false, error: `A reason is required for ${change.path || "each changed file"}.` }
    const allowed = assertForgeWorkspaceFileAllowed(change.path, change.content, { allowExecutableScripts: false })
    if (!allowed.ok) return allowed
    if (changedPaths.has(allowed.path)) return { ok: false, error: `Duplicate change for ${allowed.path}.` }
    changedPaths.add(allowed.path)
  }

  for (const affected of input.affectedFiles ?? []) {
    const normalized = normalizeForgeWorkspacePath(affected)
    if (!normalized.ok) return normalized
    if (!changedPaths.has(normalized.path)) return { ok: false, error: `Affected file ${normalized.path} has no scoped change.` }
  }

  const commands: ForgeGeneratedSiteAgentCommand[] = []
  for (const command of input.commands ?? []) {
    if (!FORGE_GENERATED_SITE_AGENT_COMMANDS.includes(command as ForgeGeneratedSiteAgentCommand)) {
      return { ok: false, error: `Command is not approved: ${command}` }
    }
    if (!commands.includes(command as ForgeGeneratedSiteAgentCommand)) commands.push(command as ForgeGeneratedSiteAgentCommand)
  }
  if (!commands.length) return { ok: false, error: "At least one approved validation command is required." }

  const maxRepairAttempts = Math.min(Math.max(input.maxRepairAttempts ?? 2, 0), 3)
  if ((input.repairAttempts?.length ?? 0) > maxRepairAttempts) return { ok: false, error: `Repair plans exceed the configured limit of ${maxRepairAttempts}.` }
  for (const attempt of input.repairAttempts ?? []) {
    if (!attempt.summary?.trim() || !attempt.changes.length) return { ok: false, error: "Each repair attempt requires a summary and scoped changes." }
    for (const change of attempt.changes) {
      const allowed = assertForgeWorkspaceFileAllowed(change.path, change.content, { allowExecutableScripts: false })
      if (!allowed.ok) return allowed
      if (!change.reason?.trim()) return { ok: false, error: `A reason is required for repair change ${change.path}.` }
      if (!changedPaths.has(allowed.path)) return { ok: false, error: `Repair change ${allowed.path} is outside the declared affected-file scope.` }
    }
    if (!Number.isFinite(attempt.confidence) || attempt.confidence < 0 || attempt.confidence > 1) return { ok: false, error: "Repair confidence must be between zero and one." }
    if (!Number.isFinite(attempt.cost) || attempt.cost < 0) return { ok: false, error: "Repair cost must be a non-negative number." }
  }

  return {
    ok: true,
    request: {
      ...input,
      affectedFiles: [...changedPaths],
      commands,
      maxRepairAttempts,
      maximumCost: Math.max(0, input.maximumCost ?? 5),
      maximumRuntimeMs: Math.min(Math.max(1_000, input.maximumRuntimeMs ?? 600_000), 3_600_000),
      minimumConfidence: Math.min(Math.max(input.minimumConfidence ?? .7, 0), 1),
      escalationRule: input.escalationRule?.trim() || "Escalate to an authorised developer with the complete repair evidence.",
    },
  }
}

export function summarizeForgeGeneratedSiteDiff(changes: ForgeGeneratedSiteChange[]) {
  return changes.map((change) => ({
    path: normalizeForgeWorkspacePath(change.path).ok ? change.path.replace(/\\/g, "/") : change.path,
    reason: change.reason.trim(),
    bytesWritten: Buffer.byteLength(change.content, "utf8"),
  }))
}
