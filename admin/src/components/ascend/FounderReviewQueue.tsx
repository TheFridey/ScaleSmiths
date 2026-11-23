"use client"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
type Job={id:string;key:string;kind:string;status:string;attempts:number;error:string|null;payload:{title:string;explanation:string;recommendedAction:string;href:string}}
export function FounderReviewQueue(){
  const [jobs,setJobs]=useState<Job[]>([])
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("")
  const reload=useCallback(async()=>{
    const r=await fetch("/api/expansion/automation/review",{cache:"no-store"})
    const j=await r.json()
    if(!r.ok)throw new Error(j.error||"Review tasks are unavailable.")
    setJobs(j.items)
  },[])
  useEffect(()=>{let active=true;reload().catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[reload])
  const action=async(type:"observe"|"prepare"|"resolve",id?:string)=>{
    setBusy(true);setError("");setNotice("")
    try{
      const r=await fetch("/api/expansion/automation/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:type,id})})
      const j=await r.json()
      if(!r.ok)throw new Error(j.error||"Unable to process review task.")
      setNotice(type==="observe"?"Current signals recorded.":type==="prepare"?(j.message||"One review task prepared."):"Review acknowledged.")
      await reload()
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return <main style={{maxWidth:960,margin:"auto",padding:"clamp(1rem,3vw,2.5rem)"}}>
    <Link href="/expansion/automation">← Operational signals</Link><h1>Durable founder review tasks</h1>
    <p>Founder-controlled internal review only. Tasks are deduplicated, retries are bounded, and no client communications or commercial actions are performed automatically.</p>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <button type="button" disabled={busy} onClick={()=>action("observe")}>Record current signals</button>
      <button type="button" disabled={busy} onClick={()=>action("prepare")}>Prepare next due review</button>
      <button type="button" disabled={busy} onClick={()=>reload().catch(e=>setError(e.message))}>Refresh</button>
    </div>
    {loading?<p role="status">Loading review tasks…</p>:jobs.length===0?<p>No internal review tasks have been recorded yet.</p>:
    <ul style={{listStyle:"none",padding:0,display:"grid",gap:16,marginTop:24}}>{jobs.map(j=>
      <li key={j.id} style={{padding:16,border:"1px solid #8a744e",borderRadius:12,overflowWrap:"anywhere"}}>
        <p><strong>{j.status.toUpperCase()}</strong> · {j.kind.replaceAll("_"," ")} · attempts {j.attempts}/5</p>
        <h2 style={{fontSize:"1.2rem"}}>{j.payload.title}</h2>
        <p>{j.payload.explanation}</p><p>{j.payload.recommendedAction}</p>
        <Link href={j.payload.href}>Review source</Link>
        {j.error&&<p>Last processing error: {j.error}</p>}
        {(j.status==="ready"||j.status==="dead")&&<p><button type="button" disabled={busy} onClick={()=>action("resolve",j.id)}>Acknowledge review</button></p>}
      </li>)}</ul>}
  </main>
}
