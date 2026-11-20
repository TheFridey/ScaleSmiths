import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import "./academy.css"

/** Shared Partner Academy frame: skip link, portal brand, grouped navigation. Future sections are labelled, not linked. */
export function AcademyShell({ current, children }: { current: "home" | "course"; children: ReactNode }) {
  return <div className="academy">
    <a className="ac-skip" href="#academy-main">Skip to content</a>
    <header className="ac-header">
      <a href="/partner" className="ac-brand"><Image src="/brand/favicon.png" alt="" width={34} height={34} unoptimized /><span>SCALESMITHS<small>PARTNER ACADEMY</small></span></a>
      <nav aria-label="Partner Academy">
        <Link href="/partner/academy" aria-current={current === "home" ? "page" : undefined}>Academy</Link>
        <a href="/partner">Partner workspace</a>
        <span className="ac-chip" title="Planned for a later release">Resource Centre · coming later</span>
        <span className="ac-chip" title="Planned for a later release">Knowledge Base · coming later</span>
      </nav>
    </header>
    <main className="ac-main" id="academy-main" tabIndex={-1}>{children}</main>
  </div>
}
