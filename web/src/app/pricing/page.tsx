import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Building2, Layers, Workflow } from "lucide-react"
import { JsonLd } from "@/components/JsonLd"
import { PageBreadcrumbs } from "@/components/Breadcrumbs"
import { buildPageMetadata } from "@/lib/page-metadata"
import { enquiryIntentHref } from "@/lib/enquiry-intents"
import {
  buildPricingSchema,
  enterpriseCommercialComponents,
  enterpriseCostFactors,
  pricingFaqs,
  webGrowthPricingItems,
} from "@/lib/service-pages"
import { STARTING_PRICE_BOUNDARY, buildPublishedOfferCatalog } from "@/lib/published-starting-prices"
import { claimWording, publicClaimMap } from "@/lib/public-claims"
import { getVerifiedPublicClaims } from "@/lib/public-claims.server"

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing Guidance",
  description:
    "Transparent pricing for websites and Growth Partnerships, with established-business transformation and enterprise systems scoped after discovery.",
  path: "/pricing",
})
export const dynamic = "force-dynamic"

const journeys = [
  {
    href: "#web-growth",
    eyebrow: "Business Websites & Growth",
    title: "Practical solutions with transparent starting prices",
    description: "Websites from £2,000, Growth Partnerships from £350/month, audits and managed email. Entry points for agreed SME scopes.",
    Icon: Building2,
  },
  {
    href: "#established-transformation",
    eyebrow: "Established Business Transformation",
    title: "Evolution, journeys, integrations and efficiency",
    description: "Corporate websites and digital estates for multi-site and established organisations. Independently scoped; never sold as a £2,000 package.",
    Icon: Layers,
  },
  {
    href: "#enterprise-systems",
    eyebrow: "Custom Platforms & Enterprise",
    title: "Bespoke architecture, workflows, security and support",
    description: "Complex platforms scoped after discovery: migrations, integrations and production support without artificial fixed retail prices.",
    Icon: Workflow,
  },
] as const

export default async function PricingPage() {
  const claims = publicClaimMap(await getVerifiedPublicClaims({ route: "/pricing", component: "pricing_card" }))
  const smeItems = webGrowthPricingItems.map((item) => ({
    ...item,
    range: item.priceClaimId ? claimWording(claims, item.priceClaimId, item.range) : item.range,
  }))
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk"
  const schema = [buildPublishedOfferCatalog(baseUrl), buildPricingSchema(baseUrl)]

  return (
    <>
      <JsonLd data={schema} />

      <section className="mx-auto max-w-[1240px] px-6 pb-16 pt-10 md:px-12 md:pb-20">
        <PageBreadcrumbs className="mb-10" items={[{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]} />
        <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Pricing</span>
        <h1 className="page-hero-display mt-2 max-w-[900px]">
          Three engagement models. One clear commercial boundary.
        </h1>
        <p className="mt-5 max-w-[720px] font-dm text-lg leading-relaxed text-t2">
          Small-business pricing stays transparent. Large transformations, corporate websites and custom systems are independently scoped after discovery, so procurement is never asked to judge complex work against a website starting price.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-3" aria-label="Pricing journeys">
          {journeys.map(({ href, eyebrow, title, description, Icon }) => (
            <a
              key={href}
              href={href}
              className="group rounded-2xl border border-b1 bg-s1 p-6 transition-colors hover:border-acc/40 md:p-8"
            >
              <div className="flex items-center gap-3 text-acc">
                <Icon size={18} aria-hidden="true" />
                <span className="font-dm text-xs font-semibold uppercase tracking-[.12em]">{eyebrow}</span>
              </div>
              <h2 className="mt-4 font-syne text-xl font-extrabold md:text-2xl">{title}</h2>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{description}</p>
              <span className="mt-5 inline-flex items-center gap-2 font-dm text-sm font-semibold text-t1">
                View this journey
                <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section id="web-growth" aria-labelledby="web-growth-heading" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Web &amp; Growth / SME services</p>
          <h2 id="web-growth-heading" className="mt-3 max-w-[760px] font-syne text-[clamp(30px,5vw,48px)] font-extrabold tracking-[-.03em]">
            Transparent guidance for websites, audits and managed services.
          </h2>
          <p className="mt-5 max-w-[680px] font-dm text-base leading-relaxed text-t2">
            These offers remain published for founder-led and local businesses. Final scope, priorities and commercial boundaries are still agreed in the proposal where discovery is required.
          </p>
          <p id="published-prices" className="mt-4 max-w-[760px] font-dm text-sm leading-relaxed text-t3">
            {STARTING_PRICE_BOUNDARY}
          </p>

          <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {smeItems.map((item) => (
              <article key={item.name} className="rounded-2xl border border-b1 bg-bg p-6">
                <h3 className="font-syne text-xl font-bold">{item.name}</h3>
                <div className="mt-3 font-syne text-lg font-bold text-acc">{item.range}</div>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.note}</p>
                {item.href ? (
                  <Link href={item.href} prefetch={false} className="mt-4 inline-flex items-center gap-1 font-dm text-sm font-semibold text-acc">
                    Learn more <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/quote" prefetch={false} className="btn-primary font-dm">
              Get a Website Quote <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/digital-growth-partnership" prefetch={false} className="btn-ghost font-dm">Explore Growth Partnerships</Link>
            <Link href="/services/business-growth-audit" prefetch={false} className="btn-ghost font-dm">Request a Business Audit</Link>
          </div>
        </div>
      </section>

      <section id="established-transformation" aria-labelledby="established-transformation-heading" className="border-b border-b1 bg-s1/40 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Established Business Transformation</p>
          <h2 id="established-transformation-heading" className="mt-3 max-w-[860px] font-syne text-[clamp(30px,5vw,48px)] font-extrabold tracking-[-.03em]">
            Corporate websites and digital estates are scoped independently.
          </h2>
          <p className="mt-5 max-w-[720px] font-dm text-base leading-relaxed text-t2">
            Multi-site organisations, professional services firms and complex service estates need journey architecture, integrations, visibility and migration continuity. That work is not a retail website package. A £2,000 starting price does not cover enterprise websites or digital transformation programmes.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-b1 bg-bg p-6">
              <h3 className="font-syne text-lg font-bold">What this covers</h3>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
                Corporate websites, customer journeys, content models, integrations to CRM and operational tools, search foundations and controlled migrations.
              </p>
            </article>
            <article className="rounded-2xl border border-b1 bg-bg p-6">
              <h3 className="font-syne text-lg font-bold">How it is priced</h3>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
                Discovery establishes improve versus integrate versus rebuild, then a written proposal sets milestones, acceptance criteria and support boundaries.
              </p>
            </article>
            <article className="rounded-2xl border border-acc/25 bg-acc/[.05] p-6">
              <h3 className="font-syne text-lg font-bold">Commercial boundary</h3>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
                SME starting prices remain available for the right briefs. They are never presented as covering established-business transformation or custom platforms.
              </p>
            </article>
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/enterprise-websites" prefetch={false} className="btn-primary font-dm">
              Enterprise websites <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href={enquiryIntentHref("enterprise")} prefetch={false} className="btn-ghost font-dm">
              Discuss digital transformation
            </Link>
            <Link href="/enterprise" prefetch={false} className="btn-ghost font-dm">
              Enterprise systems
            </Link>
          </div>
        </div>
      </section>

      <section id="enterprise-systems" aria-labelledby="enterprise-pricing-heading" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Custom Platforms &amp; Enterprise Projects</p>
          <h2 id="enterprise-pricing-heading" className="mt-3 max-w-[820px] font-syne text-[clamp(30px,5vw,48px)] font-extrabold tracking-[-.03em]">
            Custom platforms and enterprise software are scoped following discovery.
          </h2>
          <p className="mt-5 max-w-[720px] font-dm text-base leading-relaxed text-t2">
            Complex operational platforms, portals, integrations and multi-site systems are not sold as fixed retail packages. Commercial scope follows the operating model, risk and first dependable release, so IT, Operations and procurement can inspect the decision properly.
          </p>

          <div className="enterprise-panel mt-10 rounded-2xl border border-acc/25 bg-s1 p-6 md:p-8">
            <h3 className="font-syne text-xl font-bold">Typical commercial components</h3>
            <p className="mt-3 max-w-[640px] font-dm text-sm leading-relaxed text-t2">
              An enterprise engagement may combine some or all of the following. Each is scoped explicitly rather than absorbed into a vague day-rate.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {enterpriseCommercialComponents.map((item) => (
                <article key={item.title} className="rounded-xl border border-b1 bg-bg/70 p-5">
                  <h4 className="font-syne text-base font-bold">{item.title}</h4>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-16">
            <h3 className="font-syne text-[clamp(24px,3.5vw,36px)] font-extrabold tracking-[-.02em]">
              Why enterprise software is scoped differently
            </h3>
            <p className="mt-4 max-w-[680px] font-dm text-sm leading-relaxed text-t2">
              These factors materially affect cost. That is why ScaleSmiths does not publish speculative public figures for complex systems.
            </p>
            <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {enterpriseCostFactors.map((factor) => (
                <article key={factor.title} className="rounded-2xl border border-b1 bg-s1 p-5">
                  <h4 className="font-syne text-base font-bold">{factor.title}</h4>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{factor.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link href={enquiryIntentHref("enterprise")} prefetch={false} className="btn-primary font-dm">
              Discuss an Enterprise System <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/enterprise" prefetch={false} className="btn-ghost font-dm">Enterprise systems</Link>
            <Link href="/enterprise-websites" prefetch={false} className="btn-ghost font-dm">Enterprise websites</Link>
            <Link href="/custom-systems" prefetch={false} className="btn-ghost font-dm">Custom systems</Link>
            <Link href="/enterprise/delivery" prefetch={false} className="btn-ghost font-dm">Delivery process</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="pricing-faq" className="border-t border-b1 bg-s1 px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1240px]">
          <h2 id="pricing-faq" className="font-syne text-[clamp(26px,3.6vw,38px)] font-extrabold tracking-[-.025em]">Pricing questions</h2>
          <dl className="mt-6 divide-y divide-b1 rounded-2xl border border-b1 bg-bg">
            {pricingFaqs.map((faq) => (
              <div key={faq.q} className="p-6">
                <dt className="font-syne text-lg font-bold">{faq.q}</dt>
                <dd className="mt-2 font-dm text-sm leading-relaxed text-t2">{faq.a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/enterprise" prefetch={false} className="btn-ghost font-dm">Enterprise</Link>
            <Link href="/custom-systems" prefetch={false} className="btn-ghost font-dm">Custom Systems</Link>
            <Link href="/security" prefetch={false} className="btn-ghost font-dm">Security &amp; Trust</Link>
          </div>
        </div>
      </section>
    </>
  )
}
