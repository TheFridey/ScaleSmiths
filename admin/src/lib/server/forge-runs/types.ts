import "server-only"
import type { ForgeRunMode, ForgeRunPolicy } from "@/lib/forge-run-stages"

export interface CreateForgeRunInput {
  projectId: number
  actor: string
  mode?: ForgeRunMode
  policy?: ForgeRunPolicy
}
