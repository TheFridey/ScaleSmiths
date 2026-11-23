import Link from "next/link"
import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { ascendAutomationEnabled, founderAutomationSignals } from "@/lib/server/ascend-automation"
export const dynamic = "force-dynamic"
export default async function AscendAutomationPage() {
  await guardPageCapability("expansion.manage")
  if(!ascendAutomationEnabled())notFound()
  const data=await founderAutomationSignals()
  return <main style={{maxWidth:1020,margin:"auto",padding:"clamp(1rem,3vw,2.5rem)",lineHeight:1.6}}>
    <Link href="/expansion/command">← Founder command centre</Link>
    <p style={{fontSize:12,letterSpacing:".16em",color:"#d8ad63",fontWeight:700}}>OPERATION ASCEND / B2.7</p>
    <h1>Operational signals</h1>
    <p><Link href="/expansion/automation/review">Open durable founder review inbox</Link></p>
    <p>Review recorded sales and delivery exceptions. This workspace never sends notifications, changes contracts or starts work automatically.</p>
    <p role="status">{data.total} signal{data.total===1?"":"s"} · {data.counts.urgent} urgent · {data.counts.handoff} delivery handoffs</p>
    {data.total===0?<p>No actionable exceptions are currently recorded in the linked systems.</p>:
      <ul style={{padding:0,listStyle:"none",display:"grid",gap:"1rem"}}>{data.signals.map(s=>
        <li key={s.id} style={{padding:"1.25rem",border:"1px solid #66563b",borderRadius:12,minWidth:0}}>
          <p style={{fontSize:12,letterSpacing:".1em",color:"#d8ad63"}}>{s.severity.toUpperCase()} · {s.kind.replaceAll("_"," ")}</p>
          <h2 style={{fontSize:"1.2rem"}}>{s.title}</h2>
          <p>{s.explanation}</p><p><strong>Suggested action:</strong> {s.recommendedAction}</p>
          <Link href={s.href}>Review original record</Link>
        </li>)}</ul>}
    <p style={{opacity:.75}}>{data.limitations}</p>
  </main>
}
