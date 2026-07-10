import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../../auth"
import { FORGE_AI_TEST_SCHEMA, isForgeAiProvider, isForgeAiTaskType, type JsonValue } from "@/lib/forge-ai"
import { buildForgeTaskOutputMetadata, ForgeAiError, runForgeAiJson } from "@/lib/server/forge-ai"
import { requestIdFromRequest, withRequestLogContext } from "@/lib/server/request-context"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type TestResponse = {
  summary: string
  nextSteps: string[]
  riskLevel: "low" | "medium" | "high"
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const actorId = session.user?.email ?? "admin"

  return withRequestLogContext({ requestId: requestIdFromRequest(request), actorId }, async () => {
    const body = await request.json().catch(() => ({}))
    const provider = isForgeAiProvider(body.provider) ? body.provider : undefined
    const taskType = isForgeAiTaskType(body.taskType) ? body.taskType : "planning"
    const prompt = typeof body.prompt === "string" && body.prompt.trim()
      ? body.prompt.trim().slice(0, 2000)
      : "Return a concise Forge AI provider smoke-test response."

    try {
      const result = await runForgeAiJson<TestResponse & JsonValue>({
        provider,
        taskType,
        prompt,
        systemPrompt: "You are a safe internal test endpoint for ScaleSmiths Forge. Return compact structured JSON only.",
        schemaName: "forge_ai_test",
        schema: FORGE_AI_TEST_SCHEMA,
        maxTokens: 500,
        timeoutMs: 15_000,
        maxRetries: 1,
      })

      return NextResponse.json({
        ok: true,
        result,
        taskOutputMetadata: buildForgeTaskOutputMetadata(result),
      })
    } catch (error) {
      const message = error instanceof ForgeAiError ? error.safeMessage : "Unable to run Forge AI test."
      return NextResponse.json({ error: message }, { status: 502 })
    }
  })
}
