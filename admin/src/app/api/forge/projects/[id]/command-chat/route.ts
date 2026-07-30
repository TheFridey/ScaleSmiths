import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { ForgeAiError } from "@/lib/server/forge-ai"
import { ForgeCommandChatError, getForgeCommandChatState, getForgeCommandSuggestions, runForgeCommandChat } from "@/lib/server/forge-command-chat-agent"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const actor = sessionActor(session)
  const [chat, suggestions] = await Promise.all([getForgeCommandChatState(projectId), getForgeCommandSuggestions(projectId, actor)])
  return NextResponse.json({ ok: true, chat, suggestions })
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

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.message !== "string") {
    return NextResponse.json({ error: "A command message is required." }, { status: 400 })
  }

  try {
    const actor = sessionActor(session)
    const result = await runForgeCommandChat(projectId, actor, body.message, body.confirmed === true)
    const suggestions = await getForgeCommandSuggestions(projectId, actor)
    return NextResponse.json({ ...result, suggestions })
  } catch (error) {
    if (error instanceof ForgeCommandChatError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    if (error instanceof ForgeAiError) {
      return NextResponse.json({ error: error.safeMessage }, { status: 502 })
    }

    return NextResponse.json({ error: "Unable to run Forge command chat." }, { status: 500 })
  }
}
