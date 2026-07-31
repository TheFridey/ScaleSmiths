import "server-only"
import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Per-execution attribution for Forge AI spend.
 *
 * This is deliberately NOT global mutable state. `AsyncLocalStorage` scopes the value to
 * one async execution tree, so concurrent jobs in the same process each observe their own
 * run/step/job without seeing each other's — which is exactly the property the previous
 * time-window attribution lacked.
 *
 * Values here must only ever be derived from server-side job and run rows. Nothing that
 * originates from a client request may seed this scope.
 */
export interface ForgeAttribution {
  projectId: number | null
  runId: number | null
  runStepId: number | null
  jobId: number | null
  taskId: number | null
}

const EMPTY: ForgeAttribution = { projectId: null, runId: null, runStepId: null, jobId: null, taskId: null }

const attributionStorage = new AsyncLocalStorage<ForgeAttribution>()

export function withForgeAttribution<T>(attribution: Partial<ForgeAttribution>, callback: () => T): T {
  const parent = attributionStorage.getStore() ?? EMPTY
  return attributionStorage.run(mergeAttribution(parent, attribution), callback)
}

export function currentForgeAttribution(): ForgeAttribution {
  return attributionStorage.getStore() ?? EMPTY
}

/**
 * Resolves the effective identifiers for a usage record. An explicitly supplied value
 * always wins, so direct (non-job) call paths stay in control and a caller can never be
 * silently overridden by ambient scope.
 */
export function resolveForgeAttribution(explicit: Partial<ForgeAttribution> = {}): ForgeAttribution {
  return mergeAttribution(currentForgeAttribution(), explicit)
}

function mergeAttribution(base: ForgeAttribution, override: Partial<ForgeAttribution>): ForgeAttribution {
  return {
    projectId: pick(override.projectId, base.projectId),
    runId: pick(override.runId, base.runId),
    runStepId: pick(override.runStepId, base.runStepId),
    jobId: pick(override.jobId, base.jobId),
    taskId: pick(override.taskId, base.taskId),
  }
}

function pick(override: number | null | undefined, base: number | null) {
  if (override === undefined) return base
  return normalizeId(override)
}

// Ids are database primary keys. Anything that is not a positive integer is treated as
// absent rather than persisted, so a malformed value can never create a bogus FK write.
function normalizeId(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null
  return value
}
