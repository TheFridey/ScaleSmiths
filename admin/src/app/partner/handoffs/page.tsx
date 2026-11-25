import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { deliveryHandoffEnabled, partnerDeliveryHandoffs } from "@/lib/server/delivery-handoff"
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from "@/lib/server/empower-partner"
import { partnerWorkspaceEnabled } from "@/lib/server/empower-guidance"
import { partnerObjectionsEnabled } from "@/lib/server/empower-objections"
import { partnerPipelineEnabled } from "@/lib/server/partner-pipeline"
import { partnerPerformanceEnabled } from "@/lib/server/partner-performance"
import { AcademyShell } from "@/components/empower/AcademyShell"
export const dynamic = "force-dynamic"
/** B2.11: delivery handoffs share the partner frame (navigation, skip link, document scrolling) with every other partner page. */
export default async function PartnerHandoffsPage() {
  await guardPageCapability("expansion.partner")
  if (!deliveryHandoffEnabled()) notFound()
  const { handoffs } = await partnerDeliveryHandoffs()
  return <AcademyShell current="handoffs" nav={{
    academy: partnerAcademyEnabled(), resources: partnerResourcesEnabled(), knowledge: partnerKnowledgeEnabled(),
    objections: partnerObjectionsEnabled(), guidance: partnerWorkspaceEnabled(), pipeline: partnerPipelineEnabled(),
    performance: partnerPerformanceEnabled(), handoffs: true,
  }}>
    <header className="ac-page-head"><p className="ac-overline">Your clients</p><h1>Delivery handoffs</h1>
      <p>These are your opportunities formally accepted into ScaleSmiths delivery. Internal project assignments, founder notes and technical details remain private.</p></header>
    {handoffs.length === 0
      ? <div className="ac-empty"><p>No client projects have been formally handed over from your opportunities yet.</p></div>
      : <ul className="ac-list-reset">{handoffs.map((h) => <li key={h.id} className="ac-card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.125rem" }}>{h.businessName}</h2>
        <p className="ac-meta">Accepted for delivery: {new Date(h.handedOffAt).toLocaleDateString("en-GB")}</p>
        {h.delivery
          ? <p>Published client-facing status: {h.delivery.status}{h.delivery.nextStep ? " — " + h.delivery.nextStep : ""}</p>
          : <p>Delivery is being prepared internally. No client-facing status has been published yet.</p>}
      </li>)}</ul>}
  </AcademyShell>
}
