import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Terminal } from "lucide-react"
import { Portfolio } from "@/components/Portfolio"
import { AnimateIn } from "@/components/AnimateIn"
import { CTA } from "@/components/CTA"
import { buildLogs } from "@/lib/build-logs"
import { RelatedQuestions, RelatedServices } from "@/components/RelatedContent"
import { buildPageMetadata } from "@/lib/page-metadata"
import { PageBreadcrumbs } from "@/components/Breadcrumbs"

export const metadata: Metadata = buildPageMetadata({
  title: "Web Design & Development Case Studies",
  description:
    "ScaleSmiths web design and development case studies across local SEO, lead generation, e-commerce, SaaS, AI platforms and custom business systems.",
  path: "/work",
})

export default function WorkPage() {
  return (
    <>
      <div className="px-6 md:px-12 pt-10 max-w-[1240px] mx-auto">
        <PageBreadcrumbs items={[{ name: "Home", path: "/" }, { name: "Work", path: "/work" }]} />
      </div>
      <div className="mx-auto max-w-[1240px] px-6 pb-16 pt-6 md:px-12 md:pb-24 md:pt-8">
        <AnimateIn>
          <span className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">Work / Build Logs</span>
          <h1 className="mt-4 max-w-[16ch] font-syne text-[clamp(1.875rem,4.2vw,3rem)] font-bold leading-[1.18] tracking-[-0.01em]">
            Here is what we actually built.
          </h1>
          <p className="mt-6 max-w-[38rem] font-dm text-base leading-[1.75] text-t2">
            Real businesses and platforms, the scope delivered for each, and the engineering notes behind the work. No fake revenue claims, no invented testimonials.
          </p>
        </AnimateIn>
      </div>
      <Portfolio showHeading={false} grouped />
      <section className="border-y border-b1 bg-s1/40 px-6 py-24 md:px-12" aria-labelledby="engineering-logs-heading">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn className="mb-9 max-w-[760px]">
            <span className="font-dm text-xs font-semibold uppercase tracking-[.16em] text-acc">03 · Engineering build logs</span>
            <h2 id="engineering-logs-heading" className="mt-2 font-syne text-[clamp(30px,5vw,52px)] font-extrabold tracking-[-0.03em]">The production decisions behind the work.</h2>
            <p className="mt-4 font-dm text-base leading-relaxed text-t2">Concise engineering notes from ScaleSmiths systems: the constraint, the decision and the implemented approach. Sensitive operational detail stays private.</p>
          </AnimateIn>
          <div className="grid gap-4 md:grid-cols-2">
          {buildLogs.map((log) => (
            <Link key={log.slug} href={`/work/${log.slug}`} prefetch={false} className="group rounded-2xl border border-b1 bg-bg p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-b2 focus-visible:border-acc">
              <div className="mb-7 flex items-center justify-between gap-4 border-b border-b1 pb-4">
                <span className="inline-flex items-center gap-2 font-dm text-[11px] font-semibold uppercase tracking-[.14em] text-acc"><Terminal size={13} aria-hidden="true" />{log.status}</span>
                <span className="font-dm text-[11px] text-t3">{log.system}</span>
              </div>
              <h3 className="font-syne text-2xl font-bold">{log.title}</h3>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{log.summary}</p>
              <div className="mt-6 flex flex-wrap gap-1.5">{log.tags.slice(0, 3).map((tag) => <span key={tag} className="font-dm text-[11px] text-t3">#{tag.replaceAll(" ", "-").toLowerCase()}</span>)}</div>
              <span className="mt-6 inline-flex items-center gap-2 font-dm text-sm font-medium text-t2 transition-colors group-hover:text-t1">
                Read production note <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          ))}
          </div>
        </div>
      </section>
      <section aria-label="Where to go next" className="px-6 py-20 md:px-12">
        <div className="mx-auto grid max-w-[1240px] gap-14">
          <RelatedServices items={[
            { href: "/local-growth", eyebrow: "Service route", title: "Local growth", description: "Websites and search work for businesses that sell in a place." },
            { href: "/custom-systems", eyebrow: "Service route", title: "Custom systems", description: "Applications, portals, integrations and the operating layer behind them." },
            { href: "/digital-growth-partnership", eyebrow: "After launch", title: "Digital Growth Partnership", description: "How the work continues once a build is live, as it does for Confirm-A-Kill." },
          ]} />
          <RelatedQuestions items={[
            { href: "/faq#web-design", eyebrow: "FAQ", title: "What a website build involves", description: "Cost, timescale, ownership, technology and what we need before starting." },
            { href: "/faq#custom-development", eyebrow: "FAQ", title: "CRMs, portals and integrations", description: "When custom software is justified, and when an existing tool is the better buy." },
            { href: "/faq#commercial", eyebrow: "FAQ", title: "Working with ScaleSmiths", description: "Pricing, payment terms, code ownership and the kinds of business we work with." },
          ]} />
        </div>
      </section>

      <CTA />
    </>
  )
}
