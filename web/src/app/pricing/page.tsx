import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { pricingItems, buildPricingSchema } from "@/lib/service-pages"

export const metadata: Metadata = {
  title: "Pricing Guidance",
  description: "Starting points and typical ranges for ScaleSmiths websites, e-commerce builds, custom web apps, care plans, hosting and maintenance.",
  alternates: { canonical: "/pricing" },
}

export default function PricingPage() {
  const schema = buildPricingSchema(process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.io")

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="mx-auto max-w-[1240px] px-6 py-20 md:px-12">
        <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Pricing</span>
        <h1 className="mt-2 max-w-[820px] font-syne text-[clamp(38px,7vw,76px)] font-extrabold leading-none tracking-[-0.03em]">
          Useful ranges before we scope the real thing.
        </h1>
        <p className="mt-5 max-w-[640px] font-dm text-lg leading-relaxed text-t2">
          Prices depend on complexity, risk, integrations, content depth, and post-launch responsibility. These ranges help you decide whether the conversation is sensible.
        </p>
        <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {pricingItems.map((item) => (
            <article key={item.name} className="rounded-2xl border border-b1 bg-s1 p-6">
              <h2 className="font-syne text-xl font-bold">{item.name}</h2>
              <div className="mt-3 font-syne text-lg font-bold text-acc">{item.range}</div>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.note}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/quote" prefetch={false} className="btn-primary font-dm">Request a Quote <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/services" prefetch={false} className="btn-ghost font-dm">View Services</Link>
        </div>
      </section>
    </>
  )
}
