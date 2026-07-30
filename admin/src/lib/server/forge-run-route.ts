import "server-only"
import { auth } from "../../../auth"
import type { AdminRole } from "@/lib/admin-users"
import { requireRoleCapability, type Capability } from "@/lib/rbac"
import { ForgeRunError } from "./forge-run-orchestrator"
import { normalizeForgeOperatorError } from "@/lib/forge-operator-error"

export async function requireForgeRunActor(capability: Capability) {
  const session = await auth()
  if (!session?.user) throw new ForgeRunError("Unauthorized.", 401, "unauthorized")
  const role = session.user.role as AdminRole | undefined
  if (!role) throw new ForgeRunError("Admin role is unavailable.", 403, "role_missing")
  const decision = requireRoleCapability(role, capability)
  if (!decision.allowed) throw new ForgeRunError(`Missing required capability: ${capability}.`, 403, "forbidden")
  return {
    actor: session.user.email ?? session.user.name ?? "admin",
    role,
  }
}

export function parsePositiveId(value: string, label: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ForgeRunError(`Invalid ${label}.`, 400, "invalid_id")
  return parsed
}

export async function parseJsonObject(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ForgeRunError("A JSON object is required.", 400, "invalid_payload")
  return body as Record<string, unknown>
}

export function runApiError(error: unknown) {
  const operatorError = normalizeForgeOperatorError(error instanceof ForgeRunError ? error.safeMessage : error, {
    technicalReference: error instanceof ForgeRunError ? `forge:run:${error.code}` : "forge:run:internal",
    retryable: error instanceof ForgeRunError ? error.status >= 500 : true,
    metadata: error instanceof ForgeRunError ? { code: error.code, status: error.status } : {},
  })
  return Response.json(
    { error: operatorError.summary, code: error instanceof ForgeRunError ? error.code : "internal_error", operatorError },
    { status: error instanceof ForgeRunError ? error.status : 500 },
  )
}
