import {
  interpretForgeProjectIntake,
  type ForgeProjectIntakeInput,
} from "@/lib/forge-project-intake"
import { generateForgeUrlAutofill } from "@/lib/server/forge-url-autofill"
import { parseJsonObject, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"
import { approveUnifiedForgeIntake } from "@/lib/server/forge-unified-intake"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { actor } = await requireForgeRunActor("forge.approve")
    const body = await parseJsonObject(request)
    if (body.action === "interpret") return interpret(body)
    if (body.action === "approve") return approveUnifiedForgeIntake(body, actor)
    return Response.json({ error: "Unknown intake action." }, { status: 400 })
  } catch (error) {
    return runApiError(error)
  }
}

async function interpret(body: Record<string, unknown>) {
  const input = parseInput(body.input)
  if (!input.request?.trim() && !input.websiteUrl?.trim()) {
    return Response.json({ error: "Add a build request, an existing website URL, or both.", code: "intake_source_required" }, { status: 400 })
  }
  let autofill = null
  if (input.websiteUrl?.trim()) {
    try {
      autofill = await generateForgeUrlAutofill(input.websiteUrl)
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The website could not be read."
      return Response.json({
        error: `Forge could not read the existing website. ${detail}`,
        code: "website_read_failed",
        recovery: "Check the URL, try again, or remove it to continue as a new build using the written request.",
      }, { status: 422 })
    }
  }
  return Response.json({ ok: true, interpretation: interpretForgeProjectIntake(input, autofill) })
}

function parseInput(value: unknown): ForgeProjectIntakeInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as ForgeProjectIntakeInput
}
