import "server-only"
import { AsyncLocalStorage } from "node:async_hooks"

export interface ForgeAttribution {
  projectId: number | null
  runId: number | null
  runStepId: number | null
  jobId: number | null
  taskId: number | null
}

const EMPTY: ForgeAttribution = { projectId: null, runId: null, runStepId: null, jobId: null, taskId: null }

const store = new AsyncLocalStorage<ForgeAttribution>()

export function runWithForgeAttribution<T>(attribution: Partial<ForgeAttribution>, callback: () => T): T {
  const base = store.getStore() ?? EMPTY
  return store.run({ ...base, ...attribution }, callback)
}

export function currentForgeAttribution(): ForgeAttribution {
  return store.getStore() ?? EMPTY
}
