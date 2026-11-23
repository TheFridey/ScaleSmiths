"use client"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import "./handoff.css"
type Candidate = { opportunityId:string;contractId:string;clientId:number;businessName:string;partnerName:string;acceptedAt:string;agreementReference:string;scopeVersion:number;deliveryProjectId:number|null;readiness:{ready:boolean;blockers:string[];alreadyHandedOff:boolean} }
type Data = {generatedAt:string;candidates:Candidate[]}
export function HandoffWorkbench(){
  const [data,setData]=useState<Data|null>(null),[message,setMessage]=useState(""),[error,setError]=useState("")
  const [notes,setNotes]=useState<Record<string,string>>({}),[checks,setChecks]=useState<Record<string,boolean>>({}),[saving,setSaving]=useState("")
  const reload=useCallback(async()=>{
    const r=await fetch("/api/expansion/handoffs",{cache:"no-store"})
    const body=await r.json()
    if(!r.ok)throw new Error(body.error||"The delivery queue is unavailable.")
    setData(body as Data)
  },[])
  useEffect(()=>{let live=true;reload().catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[reload])
  async function approve(c:Candidate){
    setError("");setMessage("")
    if(!checks[c.opportunityId]||!notes[c.opportunityId]?.trim()){setError("Review the accepted agreement, confirm the selection and provide a handoff note.");return}
    setSaving(c.opportunityId)
    try {
      const r=await fetch("/api/expansion/handoffs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"approve",opportunityId:c.opportunityId,expectedContractId:c.contractId,confirm:true,reason:notes[c.opportunityId]})})
      const result=await r.json()
      if(!r.ok)throw new Error(result.error||"Handoff was not approved.")
      setMessage(result.result.replay?"This contract was already handed over; no second project was created.":"An internal delivery project was created and linked to the accepted contract.")
      await reload()
    }catch(e){setError((e as Error).message)}finally{setSaving("")}
  }
  return <main className="hd-page"><Link href="/expansion">← Partner operations</Link><p className="hd-eyebrow">OPERATION ASCEND / B2.6</p>
    <h1>Sales-to-delivery handoffs</h1>
    <p>Review accepted commercial agreements and create internal delivery projects. A handoff does not publish anything to the client, assign Forge work, or change a partner’s commission.</p>
    {error&&<p role="alert" className="hd-error">{error}</p>}{message&&<p role="status" className="hd-success">{message}</p>}
    <button type="button" onClick={()=>reload().catch(e=>setError(e.message))}>Refresh contracts</button>
    {!data?<p role="status">Loading accepted agreements…</p>:data.candidates.length===0?<p className="hd-empty">No accepted contracts are awaiting review.</p>:
      <div className="hd-list">{data.candidates.map(c=><section key={c.opportunityId} className="hd-card" aria-label={c.businessName}>
        <h2>{c.businessName}</h2><p>Originating partner: {c.partnerName}</p>
        <dl><div><dt>Agreement reference</dt><dd>{c.agreementReference}</dd></div><div><dt>Accepted scope version</dt><dd>{c.scopeVersion}</dd></div>
        <div><dt>Accepted on</dt><dd>{new Date(c.acceptedAt).toLocaleDateString("en-GB")}</dd></div></dl>
        {c.deliveryProjectId?<p className="hd-success">Already handed over. <Link href={"/projects/"+c.deliveryProjectId}>Open internal delivery project</Link></p>:
          !c.readiness.ready?<div className="hd-blocked"><strong>Cannot hand over yet</strong><ul>{c.readiness.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul></div>:
          <div className="hd-approve">
            <label htmlFor={"hd-note-"+c.opportunityId}>Founder handoff note</label>
            <textarea id={"hd-note-"+c.opportunityId} rows={3} minLength={10} maxLength={1000} value={notes[c.opportunityId]||""} onChange={e=>setNotes(n=>({...n,[c.opportunityId]:e.target.value}))} placeholder="Document the verified scope, agreed requirements and internal next steps."/>
            <label className="hd-check"><input type="checkbox" checked={!!checks[c.opportunityId]} onChange={e=>setChecks(n=>({...n,[c.opportunityId]:e.target.checked}))}/>
              I reviewed this specific accepted contract and authorise creation of an internal delivery project.</label>
            <button type="button" disabled={saving!==""||!checks[c.opportunityId]||(notes[c.opportunityId]?.trim().length??0)<10} onClick={()=>approve(c)}>
              {saving===c.opportunityId?"Recording approval…":"Approve delivery handoff"}</button>
          </div>}
      </section>)}</div>}
    <p className="hd-muted">Handoff approval is immutable and linked one-to-one to the accepted contract. Founder notes and technical delivery details are never shown to originating partners.</p>
  </main>
}
