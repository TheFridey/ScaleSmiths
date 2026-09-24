import type { ReactNode } from "react"
import Link from "next/link"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { LEGAL_EFFECTIVE_DATE, LEGAL_LAST_UPDATED, LEGAL_VERSION } from "@/lib/legal"
import { siteBaseUrl } from "@/lib/site-identity"
import { buildBreadcrumbSchema } from "@/lib/structured-data"

export function LegalDocument({ title, introduction, slug, children }: { title: string; introduction: string; slug?: string; children: ReactNode }) {
  const trail = slug
    ? [{ name: "Home", path: "/" }, { name: "Legal", path: "/legal" }, { name: title, path: `/legal/${slug}` }]
    : [{ name: "Home", path: "/" }, { name: "Legal", path: "/legal" }]
  return (
    <article className="mx-auto max-w-[880px] px-6 py-16 md:px-12 md:py-24">
      {slug ? <JsonLd data={buildBreadcrumbSchema(siteBaseUrl(), trail)} /> : null}
      <Breadcrumbs className="mb-10" items={trail.map((item, index) => ({ name: item.name, href: index < trail.length - 1 ? item.path : undefined }))} />
      <header className="border-b border-b1 pb-10">
        <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Legal information</p>
        <h1 className="mt-3 font-syne text-[clamp(38px,7vw,72px)] font-extrabold leading-none tracking-[-0.035em]">{title}</h1>
        <p className="mt-6 max-w-[720px] font-dm text-base leading-relaxed text-t2">{introduction}</p>
        <p className="mt-5 font-dm text-xs text-t3">Version {LEGAL_VERSION} · Effective {LEGAL_EFFECTIVE_DATE} · Last updated {LEGAL_LAST_UPDATED}</p>
        <p className="mt-4 text-xs"><Link href="/legal" className="text-acc underline-offset-4 hover:underline">Legal hub</Link><span className="mx-2 text-t3">·</span><span className="text-t3">Print or save using your browser</span></p>
      </header>
      <div className="legal-document mt-10 space-y-10 font-dm text-sm leading-7 text-t2">{children}</div>
    </article>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 font-syne text-2xl font-bold tracking-tight text-t1">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
