/** B2.8: fail-closed validation for persisted internal review advisories. */
import type { AutomationSignal } from './ascend-automation'
const sources = new Set(['sales_command', 'delivery_handoff'])
const severities = new Set(['attention', 'urgent'])
export function safeReviewHref(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 2 || value.length > 2048 || !value.startsWith('/') || value.startsWith('//')) return false
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return false
  try {
    const parsed = new URL(value, 'https://internal.invalid')
    return parsed.origin === 'https://internal.invalid' && parsed.pathname.startsWith('/expansion') &&
      (parsed.pathname === '/expansion' || parsed.pathname.startsWith('/expansion/'))
  } catch { return false }
}
export function isSafeReviewSignal(value: unknown): value is AutomationSignal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const s = value as Record<string, unknown>
  return typeof s.id === 'string' && s.id.length > 0 && s.id.length <= 200 &&
    typeof s.kind === 'string' && s.kind.length > 0 && s.kind.length <= 80 &&
    sources.has(String(s.source)) && severities.has(String(s.severity)) &&
    typeof s.title === 'string' && s.title.length > 0 && s.title.length <= 500 &&
    typeof s.explanation === 'string' && s.explanation.length <= 2000 &&
    typeof s.recommendedAction === 'string' && s.recommendedAction.length <= 2000 &&
    typeof s.observedAt === 'string' && Number.isFinite(Date.parse(s.observedAt)) &&
    safeReviewHref(s.href)
}
