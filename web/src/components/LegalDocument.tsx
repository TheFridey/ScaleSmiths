import type { ReactNode } from "react"
import { LEGAL_LAST_UPDATED, LEGAL_VERSION } from "@/lib/legal"

export function LegalDocument({ title, introduction, children }: { title: string; introduction: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[880px] px-6 py-16 md:px-12 md:py-24">
      <header className="border-b border-b1 pb-10">
        <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Legal information</p>
        <h1 className="mt-3 font-syne text-[clamp(38px,7vw,72px)] font-extrabold leading-none tracking-[-0.035em]">{title}</h1>
        <p className="mt-6 max-w-[720px] font-dm text-base leading-relaxed text-t2">{introduction}</p>
        <p className="mt-5 font-dm text-xs text-t3">Version {LEGAL_VERSION} · Last updated {LEGAL_LAST_UPDATED}</p>
      </header>
      <div className="legal-document mt-10 space-y-10 font-dm text-sm leading-7 text-t2">{children}</div>
    </article>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-24">
      <h2 className="mb-3 font-syne text-2xl font-bold tracking-tight text-t1">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
