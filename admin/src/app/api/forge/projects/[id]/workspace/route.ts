import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { auth } from "../../../../../../../auth"
import { db } from "@/lib/db"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"
import { createForgeProjectWorkspace, ForgeWorkspaceError } from "@/lib/server/forge-workspace"
import { forgeActivityLogs, forgeMemories, forgeProjects } from "@/lib/schema"

export const dynamic = "force-dynamic"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)

  if (!project) {
    return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  }

  if (project.status === "archived") {
    return NextResponse.json({ error: "Archived Forge projects cannot create new generated-site workspaces." }, { status: 400 })
  }

  try {
    const [existingMemory] = await db
      .select()
      .from(forgeMemories)
      .where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY)))
      .limit(1)
    const existingWorkspace = readForgeWorkspaceMemory(existingMemory?.value)
    const workspace = await createForgeProjectWorkspace(project, existingWorkspace)
    const now = new Date()
    const actor = sessionActor(session)

    await db.transaction(async (tx) => {
      if (existingMemory) {
        await tx
          .update(forgeMemories)
          .set({
            value: JSON.stringify(workspace),
            source: "forge_workspace",
            updatedAt: now,
          })
          .where(eq(forgeMemories.id, existingMemory.id))
      } else {
        await tx.insert(forgeMemories).values({
          projectId,
          key: FORGE_WORKSPACE_MEMORY_KEY,
          value: JSON.stringify(workspace),
          source: "forge_workspace",
          updatedAt: now,
        })
      }

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "workspace_created",
        message: `Created generated-site workspace for ${project.name}.`,
        metadataJson: {
          relativePath: workspace.relativePath,
          fileCount: workspace.fileCount,
          template: workspace.template,
        },
      })
    })

    return NextResponse.json({ ok: true, workspace })
  } catch (error) {
    if (error instanceof ForgeWorkspaceError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to create Forge generated-site workspace." }, { status: 500 })
  }
}
