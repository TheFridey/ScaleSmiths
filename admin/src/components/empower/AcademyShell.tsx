import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import "./academy.css"

export type PartnerNav = { academy?: boolean; resources?: boolean }
/** Shared frame for the Partner Academy and Resource Centre: skip link, brand, grouped navigation. Sections that are off are labelled, not linked. */
export function AcademyShell({ current, nav = { academy: true }, children }: { current: "home" | "course" | "resources"; nav?: PartnerNav; children: ReactNode }) {
  return <div className="academy">
    <a className="ac-skip" href="#academy-main">Skip to content</a>
    <header className="ac-header">
      <a href="/partner" className="ac-brand"><Image src="/brand/favicon.png" alt="" width={34} height={34} unoptimized /><span>SCALESMITHS<small>{current === "resources" ? "RESOURCE CENTRE" : "PARTNER ACADEMY"}</small></span></a>
      <nav aria-label="Partner learning and resources">
        {nav.academy && <Link href="/partner/academy" aria-current={current === "home" ? "page" : undefined}>Academy</Link>}
        {nav.resources ? <Link href="/partner/resources" aria-current={current === "resources" ? "page" : undefined}>Resource Centre</Link> : <span className="ac-chip" title="Planned for a later release">Resource Centre · coming later</span>}
        <a href="/partner">Partner workspace</a>
        <span className="ac-chip" title="Planned for a later release">Knowledge Base · coming later</span>
      </nav>
    </header>
    <main className="ac-main" id="academy-main" tabIndex={-1}>{children}</main>
  </div>
}
