import "server-only"
import { createHash } from "node:crypto"
import type { loadStageContext } from "./run-repository"

export function computeInputHash(context: Awaited<ReturnType<typeof loadStageContext>>, types: readonly string[]) {
  const hashes = types.flatMap((type) => context.artifactHashesByType.get(type) ?? []).sort()
  return createHash("sha256").update(JSON.stringify(hashes)).digest("hex")
}
