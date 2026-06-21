import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { ForgeDeployError, runForgeDeployAgent, type ForgeDeployAction } from "@/lib/server/forge-deploy-agent"
import { isForgeDeployMethod, type ForgeDeployConfirmations } from "@/lib/forge-deploy"

export const dynamic = "force-dynamic"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function parseAction(value: unknown): ForgeDeployAction | null {
  return value === "prepare" || value === "update_checklist" || value === "mark_ready" || value === "mark_deployed" ? value : null
}

function parseConfirmations(value: unknown): Partial<ForgeDeployConfirmations> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const result: Partial<ForgeDeployConfirmations> = {}
  for (const [key, raw] of Object.entries(input)) {
    if (typeof raw === "boolean") (result as Record<string, boolean>)[key] = raw
  }
  return result
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const body = await request.json().catch(() => ({})) as { action?: unknown; method?: unknown; confirmations?: unknown }
  const action = parseAction(body.action)

  if (!action) {
    return NextResponse.json({ error: "Invalid deployment action." }, { status: 400 })
  }

  try {
    const result = await runForgeDeployAgent(projectId, sessionActor(session), {
      action,
      method: isForgeDeployMethod(body.method) ? body.method : undefined,
      confirmations: parseConfirmations(body.confirmations),
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ForgeDeployError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to run deployment workflow." }, { status: 500 })
  }
}
