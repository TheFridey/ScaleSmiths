import { requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"
import { loadForgeOperationalHealth } from "@/lib/server/forge-operational-health"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    await requireForgeRunActor("forge.read")
    return Response.json({ ok: true, ...(await loadForgeOperationalHealth()) })
  } catch (error) {
    return runApiError(error)
  }
}
