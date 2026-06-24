import "server-only"
import {
  buildClientRequestTriagePrompt,
  CLIENT_REQUEST_TRIAGE_SCHEMA,
  createFallbackClientRequestTriage,
  type ClientRequestTriageInput,
  type ClientRequestTriageResult,
} from "@/lib/client-request-triage"
import { ForgeAiError, runForgeAiJson } from "@/lib/server/forge-ai"

export interface ClientRequestTriageRun {
  result: ClientRequestTriageResult
  source: "ai" | "fallback"
  error?: string
}

export async function generateClientRequestTriage(input: ClientRequestTriageInput): Promise<ClientRequestTriageRun> {
  const fallback = createFallbackClientRequestTriage(input)

  try {
    const result = await runForgeAiJson<ClientRequestTriageResult>({
      taskType: "planning",
      schemaName: "client_request_triage",
      schema: CLIENT_REQUEST_TRIAGE_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Request Triage assistant.",
        "Return admin-assist suggestions only.",
        "Do not claim live inspection, crawling, testing, or verification.",
        "Never include secrets, credentials, or private operational details.",
        "The suggestedClientReply is a draft for an admin to review, not a message sent to the client.",
      ].join(" "),
      prompt: buildClientRequestTriagePrompt(input),
      maxTokens: 900,
      timeoutMs: 20_000,
      maxRetries: 1,
      mockData: fallback,
      fallbackOnSchemaMismatch: true,
    })

    return {
      result: result.data,
      source: result.provider === "mock" ? "fallback" : "ai",
    }
  } catch (error) {
    return {
      result: fallback,
      source: "fallback",
      error: error instanceof ForgeAiError ? error.safeMessage : "Forge triage fell back to deterministic rules.",
    }
  }
}
