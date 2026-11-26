import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import "./academy.css"

export type PartnerNav = { academy?: boolean; resources?: boolean; knowledge?: boolean; objections?: boolean; guidance?: boolean; pipeline?: boolean; performance?: boolean; handoffs?: boolean }
/**
 * `contentState` declares whether the content this frame will show has rendered. Pages that load from the API after
 * hydration publish `loading` in the server HTML and `ready` once the content is on screen, so browser acceptance and
 * any assistive technology can tell a painted skeleton from the finished page. A page with no asynchronous region is
 * `ready` when it is parsed, which is the default and the case for every server-rendered page that uses this frame.
 */
export type ContentState = "loading" | "ready"
/** Shared frame for the Partner Academy and Resource Centre: skip link, brand, grouped navigation. Sections that are off are labelled, not linked. */
export function AcademyShell({ current, nav = { academy: true }, contentState = "ready", children }: { current: "home" | "course" | "resources" | "knowledge" | "agreement" | "objections" | "guidance" | "pipeline" | "performance" | "handoffs"; nav?: PartnerNav; contentState?: ContentState; children: ReactNode }) {
  return <div className="academy">
    <a className="ac-skip" href="#academy-main">Skip to content</a>
    <header className="ac-header">
      <a href="/partner" className="ac-brand"><Image src="/brand/favicon.png" alt="" width={34} height={34} unoptimized /><span>SCALESMITHS<small>{current === "resources" ? "RESOURCE CENTRE" : current === "knowledge" ? "KNOWLEDGE BASE" : current === "agreement" ? "PARTNER AGREEMENT" : current === "objections" ? "OBJECTION HANDLING" : current === "guidance" ? "FIND GUIDANCE" : current === "pipeline" ? "PIPELINE" : current === "performance" ? "MY PERFORMANCE" : current === "handoffs" ? "DELIVERY HANDOFFS" : "PARTNER ACADEMY"}</small></span></a>
      <nav aria-label="Partner learning and resources">
        {/* B2.1: the partner's own pipeline; linked only when switched on. */}
        {nav.performance && <Link href="/partner/performance" aria-current={current === "performance" ? "page" : undefined}>Performance</Link>}
        {nav.handoffs && <Link href="/partner/handoffs" aria-current={current === "handoffs" ? "page" : undefined}>Delivery</Link>}
        {nav.pipeline && <Link href="/partner/pipeline" aria-current={current === "pipeline" ? "page" : undefined}>Pipeline</Link>}
        {/* B1.6: one search across everything; linked only when switched on. */}
        {nav.guidance && <Link href="/partner/guidance" aria-current={current === "guidance" ? "page" : undefined}>Find guidance</Link>}
        {nav.academy && <Link href="/partner/academy" aria-current={current === "home" ? "page" : undefined}>Academy</Link>}
        {nav.resources ? <Link href="/partner/resources" aria-current={current === "resources" ? "page" : undefined}>Resource Centre</Link> : <span className="ac-chip" title="Planned for a later release">Resource Centre · coming later</span>}
        <a href="/partner">Partner workspace</a>
        {nav.knowledge ? <Link href="/partner/knowledge" aria-current={current === "knowledge" ? "page" : undefined}>Knowledge Base</Link> : <span className="ac-chip" title="Planned for a later release">Knowledge Base · coming later</span>}
        {/* B1.5: linked only when switched on; no placeholder for an unreleased module. */}
        {nav.objections && <Link href="/partner/objections" aria-current={current === "objections" ? "page" : undefined}>Objection handling</Link>}
      </nav>
    </header>
    <main className="ac-main" id="academy-main" tabIndex={-1} data-content-state={contentState}>{children}</main>
  </div>
}
