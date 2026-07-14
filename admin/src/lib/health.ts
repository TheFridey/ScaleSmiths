import { timingSafeEqual } from "node:crypto"
import { errorMonitoringHealth } from "./server/monitoring"

export function isValidHealthToken(provided: string | null, expected = process.env.ADMIN_HEALTH_CHECK_TOKEN): boolean {
  if (!provided || !expected || expected.length < 32) return false
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function healthPayload() {
  return {
    status: "ok" as const,
    service: "scalesmiths-admin",
    environment: process.env.NODE_ENV ?? "unknown",
    release: process.env.SS_RELEASE_ID || process.env.ERROR_MONITORING_RELEASE || undefined,
    monitoring: errorMonitoringHealth(),
  }
}
