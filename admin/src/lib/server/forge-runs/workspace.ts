import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeMemories, forgeProjects } from "@/lib/schema"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"
import { createForgeProjectWorkspace } from "../forge-workspace"
import { ForgeRunError } from "./errors"
import { recordRunEvent } from "./events"

export async function ensureRunWorkspace(projectId: number, runId: number, actor: string) {
  const [[project], [existingMemory]] = await Promise.all([
    db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1),
    db.select().from(forgeMemories).where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY))).limit(1),
  ])
  if (!project) throw new ForgeRunError("Forge project not found.", 404, "project_not_found")
  const existingWorkspace = readForgeWorkspaceMemory(existingMemory?.value)
  if (existingWorkspace) return existingWorkspace
  const workspace = await createForgeProjectWorkspace(project)
  const now = new Date()
  await db.transaction(async (tx) => {
    const [memory] = await tx.select({ id: forgeMemories.id }).from(forgeMemories).where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY))).orderBy(desc(forgeMemories.updatedAt)).limit(1)
    const memoryValues = { value: JSON.stringify(workspace), source: "forge_run", updatedAt: now }
    if (memory) await tx.update(forgeMemories).set(memoryValues).where(eq(forgeMemories.id, memory.id))
    else await tx.insert(forgeMemories).values({ projectId, key: FORGE_WORKSPACE_MEMORY_KEY, ...memoryValues })
    await tx.insert(forgeActivityLogs).values({ projectId, actor, action: "workspace_created", message: `Created generated-site workspace for ${project.name} as part of Forge Run #${runId}.`, metadataJson: { runId, relativePath: workspace.relativePath, fileCount: workspace.fileCount, template: workspace.template } })
  })
  await recordRunEvent(runId, null, "workspace_created", actor, "Created the isolated generated-site workspace before code generation.", { relativePath: workspace.relativePath, fileCount: workspace.fileCount })
  return workspace
}
