import "server-only"
import { ExpansionError } from "@/lib/expansion"
import { operationalSignals } from "@/lib/ascend-automation"
import { requireCapability } from "./rbac"
import { founderSalesCommandEnabled, founderCommandCentre } from "./sales-command"
import { deliveryHandoffEnabled, founderHandoffQueue } from "./delivery-handoff"

/** B2.7 is a founder-only derived projection. No worker, outbox, notification or commercial mutation. */
export const ascendAutomationEnabled = () => process.env.ASCEND_AUTOMATION_ENABLED === "true"
export async function founderAutomationSignals(now = new Date()) {
  if (!ascendAutomationEnabled()) throw new ExpansionError("Operational automation is unavailable.", 404)
  if (!founderSalesCommandEnabled() || !deliveryHandoffEnabled())
    throw new ExpansionError("The sales command centre and delivery handoff must be enabled first.", 503)
  await requireCapability("expansion.manage")
  const [command, handoff] = await Promise.all([founderCommandCentre(now), founderHandoffQueue()])
  const signals = operationalSignals(command.queue, handoff.candidates, now)
  return {
    generatedAt: now.toISOString(),
    mode: "read_only" as const,
    total: signals.length,
    counts: {
      urgent: signals.filter(s => s.severity === "urgent").length,
      attention: signals.filter(s => s.severity === "attention").length,
      handoff: signals.filter(s => s.source === "delivery_handoff").length,
    },
    evidence: { commandGeneratedAt: command.generatedAt, handoffGeneratedAt: handoff.generatedAt },
    signals,
    limitations: "Derived from independently authorised source snapshots. No automatic action is taken and no commercial state is changed.",
  }
}
