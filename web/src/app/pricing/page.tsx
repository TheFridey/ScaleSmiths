import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { pricingItems, buildPricingSchema } from "@/lib/service-pages"
import { claimWording, publicClaimMap } from "@/lib/public-claims"
import { getVerifiedPublicClaims } from "@/lib/public-claims.server"

export const metadata: Metadata = {
  title: "Pricing Guidance",
  description: "How ScaleSmiths scopes websites, custom systems, Digital Growth Partnerships, managed business email, hosting and maintenance.",
  alternates: { canonical: "/pricing" },
}
export const dynamic = "force-dynamic"

export default async function PricingPage() {
  const claims = publicClaimMap(await getVerifiedPublicClaims({ route: "/pricing", component: "pricing_card" }))
  const visibleItems = pricingItems.map((item) => ({
    ...item,
    range: item.priceClaimId ? claimWording(claims, item.priceClaimId, item.range) : item.range,
  }))
  const schema = buildPricingSchema(process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk")

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="mx-auto max-w-[1240px] px-6 py-20 md:px-12">
        <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Pricing</span>
        <h1 className="mt-2 max-w-[820px] font-syne text-[clamp(38px,7vw,76px)] font-extrabold leading-none tracking-[-0.03em]">
          Clear scoping before the proposal.
        </h1>
        <p className="mt-5 max-w-[640px] font-dm text-lg leading-relaxed text-t2">
          Prices depend on complexity, risk, integrations, content depth, and ongoing responsibility. Verified current guidance appears below only after its evidence and review date have been approved.
        </p>
        <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <article key={item.name} className="rounded-2xl border border-b1 bg-s1 p-6">
              <h2 className="font-syne text-xl font-bold">{item.name}</h2>
              <div className="mt-3 font-syne text-lg font-bold text-acc">{item.range}</div>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.note}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/quote" prefetch={false} className="btn-primary font-dm">Request a Quote <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/digital-growth-partnership" prefetch={false} className="btn-ghost font-dm">Explore Growth Partnership</Link>
        </div>
      </section>
    </>
  )
}
