/**
 * Operation ASCEND B2.7: bounded, explainable read-only operating signals.
 * Signals are observations, never instructions to mutate commercial state.
 */
export type AutomationSeverity = "attention" | "urgent"
export type AutomationSource = "sales_command" | "delivery_handoff"
export type AutomationSignal = {
  id: string
  source: AutomationSource
  kind: string
  severity: AutomationSeverity
  title: string
  explanation: string
  href: string
  observedAt: string
  recommendedAction: string
}
export type CommandQueueItem = {
  id: string; kind: string; title: string; since: string; href: string; ageDays: number
}
export type DeliveryCandidate = {
  opportunityId: string; businessName: string; acceptedAt: string
  readiness: { ready: boolean; blockers: string[]; alreadyHandedOff: boolean }
}
export function operationalSignals(
  queue: readonly CommandQueueItem[],
  delivery: readonly DeliveryCandidate[],
  now = new Date(),
): AutomationSignal[] {
  if (!Number.isFinite(now.getTime())) throw new RangeError("A valid clock is required.")
  const signals: AutomationSignal[] = []
  for (const row of queue) {
    const time = new Date(row.since)
    if (!Number.isFinite(time.getTime()) || time.getTime() > now.getTime()) continue
    const mapping: Record<string,{ severity: AutomationSeverity; action: string; explanation: string }> = {
      notification_failed: { severity: "urgent", action: "Review the failed notification before contacting anyone.", explanation: "The notification system recorded a delivery failure." },
      assistance: { severity: "attention", action: "Review the partner's assistance request.", explanation: "The partner has requested founder assistance." },
      meeting: { severity: "attention", action: "Review and respond to the requested meeting.", explanation: "A meeting request remains in the founder queue." },
      scope_review: { severity: "attention", action: "Review the submitted scope and technical requirements.", explanation: "An opportunity is awaiting founder scoping." },
      proposal_follow_up: { severity: "attention", action: "Review the approved offer before any client follow-up.", explanation: "The approved opportunity meets the existing proposal follow-up rule." },
      stalled: { severity: "attention", action: "Check the opportunity before recommending a follow-up.", explanation: "The opportunity meets the existing stalled-opportunity rule." },
      application: { severity: "attention", action: "Review the pending application.", explanation: "An applicant is awaiting a founder decision." },
    }
    const rule = mapping[row.kind]
    if (!rule || !row.id || !row.href.startsWith("/") || row.href.startsWith("//")) continue
    signals.push({
      id: "sales:" + row.id, source: "sales_command", kind: row.kind, severity: rule.severity,
      title: row.title, explanation: rule.explanation, href: row.href,
      observedAt: time.toISOString(), recommendedAction: rule.action,
    })
  }
  for (const c of delivery) {
    if (c.readiness.alreadyHandedOff) continue
    const time = new Date(c.acceptedAt)
    if (!Number.isFinite(time.getTime()) || time.getTime() > now.getTime()) continue
    const ready = c.readiness.ready
    signals.push({
      id: "handoff:" + c.opportunityId, source: "delivery_handoff",
      kind: ready ? "handoff_ready" : "handoff_blocked",
      severity: "attention", title: c.businessName, observedAt: time.toISOString(),
      explanation: ready ? "An accepted contract is eligible for founder delivery handoff." : "The accepted contract has unresolved handoff requirements.",
      recommendedAction: ready ? "Review the accepted agreement and explicitly approve a handoff if appropriate." : "Resolve the recorded blockers before approving delivery.",
      href: "/expansion/handoffs",
    })
  }
  const priority = (s: AutomationSignal) => s.severity === "urgent" ? 0 : 1
  return signals.sort((a,b) => priority(a)-priority(b) || a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id))
}
