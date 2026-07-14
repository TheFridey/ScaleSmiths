import { timingSafeEqual } from "node:crypto"

export function isValidMonitoringSelfTestToken(provided: string | null, expected = process.env.MONITORING_SELF_TEST_TOKEN) {
  if (!provided || !expected || expected.length < 32) return false
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}
