import Link from "next/link"
import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { deliveryHandoffEnabled, partnerDeliveryHandoffs } from "@/lib/server/delivery-handoff"
export const dynamic = "force-dynamic"
export default async function PartnerHandoffsPage(){
  await guardPageCapability("expansion.partner")
  if(!deliveryHandoffEnabled())notFound()
  const {handoffs}=await partnerDeliveryHandoffs()
  return <main style={{maxWidth:880,margin:"auto",padding:"2rem",lineHeight:1.6}}>
    <Link href="/partner">← Partner workspace</Link><h1>Delivery handoffs</h1>
    <p>These are your opportunities formally accepted into ScaleSmiths delivery. Internal project assignments, founder notes and technical details remain private.</p>
    {handoffs.length===0?<p>No client projects have been formally handed over from your opportunities yet.</p>:
      <ul>{handoffs.map(h=><li key={h.id} style={{marginBottom:"1.5rem"}}>
        <strong>{h.businessName}</strong><p>Accepted for delivery: {new Date(h.handedOffAt).toLocaleDateString("en-GB")}</p>
        {h.delivery?<p>Published client-facing status: {h.delivery.status}{h.delivery.nextStep?" — "+h.delivery.nextStep:""}</p>:<p>Delivery is being prepared internally. No client-facing status has been published yet.</p>}
      </li>)}</ul>}
  </main>
}
