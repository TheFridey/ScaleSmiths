export interface ReconciliationLease {
  status: string
  owner?: string | null
  expiresAt?: Date | null
}

export function isOrphanedLease(resource: ReconciliationLease, activeStatuses: readonly string[], now: Date): boolean {
  return activeStatuses.includes(resource.status) && resource.expiresAt instanceof Date && resource.expiresAt.getTime() < now.getTime()
}

export function shouldRetainForgeEvidence(resource: "workspace" | "artifact" | "deployment_candidate"): true {
  void resource
  return true
}

export async function runIndependentReconciliationOperations<T>(operations: ReadonlyArray<{ name: string; run: () => Promise<T[]> }>) {
  const completed: T[] = []
  const failures: Array<{ name: string; error: string }> = []
  for (const operation of operations) {
    try {
      completed.push(...await operation.run())
    } catch (error) {
      failures.push({ name: operation.name, error: error instanceof Error ? error.message : "Unknown reconciliation failure." })
    }
  }
  return { completed, failures }
}
