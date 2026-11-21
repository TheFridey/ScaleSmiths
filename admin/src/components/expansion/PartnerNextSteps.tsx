"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Step = { key: string; title: string; detail: string; done: boolean; href?: string; action?: () => void; cta: string }

/**
 * First-login guidance for an active partner. Every item points at something that exists and is switched on; modules that are
 * off are not offered. Commission terms are not restated here: partners read them in their accepted agreement and plan.
 */
export function PartnerNextSteps({ academy, resources, knowledge, opportunities, onPipeline }: { academy: boolean; resources: boolean; knowledge: boolean; opportunities: number; onPipeline: () => void }) {
  const [agreement, setAgreement] = useState<{ accepted: boolean; pending: boolean } | null>(null)
  useEffect(() => {
    let live = true
    fetch("/api/partner/agreement", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((d) => { if (live && d) setAgreement({ accepted: Boolean(d.accepted), pending: Boolean(d.pending) }) }).catch(() => {})
    return () => { live = false }
  }, [])
  const steps: Step[] = [
    { key: "agreement", title: agreement?.pending ? "Accept the updated partner agreement" : "Your partner agreement", detail: agreement?.pending ? "ScaleSmiths has issued a new version. Read and accept it." : "Read or download the agreement you accepted.", done: Boolean(agreement?.accepted && !agreement.pending), href: "/partner/agreement", cta: agreement?.pending ? "Review now" : "View agreement" },
    ...(academy ? [{ key: "academy", title: "Start the Partner Academy", detail: "Short lessons on discovery, presenting ScaleSmiths and when to escalate.", done: false, href: "/partner/academy", cta: "Open Academy" }] : []),
    ...(resources ? [{ key: "resources", title: "Browse the Resource Centre", detail: "Approved guides and client-safe material you can share.", done: false, href: "/partner/resources", cta: "Open resources" }] : []),
    ...(knowledge ? [{ key: "knowledge", title: "Check the Knowledge Base", detail: "Precise answers to common client questions, with when to escalate.", done: false, href: "/partner/knowledge", cta: "Search answers" }] : []),
    { key: "first", title: "Register your first business", detail: "Introduce a business and complete a short discovery. ScaleSmiths reviews scope and capacity before anything is committed.", done: opportunities > 0, action: onPipeline, cta: opportunities > 0 ? "Open pipeline" : "Register a business" },
  ]
  const complete = steps.filter((s) => s.done).length
  return <section className="ex-panel ex-next" aria-labelledby="next-steps-heading">
    <div className="ex-section-heading"><div><p className="ex-overline">GETTING STARTED</p><h2 id="next-steps-heading">Your next steps</h2></div>
      <span className="ex-badge" aria-label={`${complete} of ${steps.length} steps complete`}>{complete}/{steps.length}</span></div>
    <div className="ex-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={complete} aria-label="Onboarding progress"><span style={{ width: `${(complete / steps.length) * 100}%` }} /></div>
    <ol className="ex-next-list">{steps.map((s) => <li key={s.key} data-done={s.done}>
      <div><strong>{s.done ? <span className="sr-only">Done: </span> : null}{s.title}</strong><p>{s.detail}</p></div>
      {s.href ? <Link className="ex-next-cta" href={s.href}>{s.cta}</Link> : <button type="button" className="ex-next-cta" onClick={s.action}>{s.cta}</button>}
    </li>)}</ol>
  </section>
}
