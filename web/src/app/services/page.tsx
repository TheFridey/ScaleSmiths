import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { CTA } from "@/components/CTA"
import { buildServiceHubSchema, serviceHubItems } from "@/lib/service-pages"

export const metadata: Metadata = {
  title: "Services",
  description: "Conversion websites, local business sites, e-commerce builds, custom web apps, SEO/AEO landing pages, care plans, hosting and maintenance.",
  alternates: { canonical: "/services" },
}

export default function ServicesPage() {
  const schema = buildServiceHubSchema(process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.io")

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="mx-auto max-w-[1240px] px-6 py-20 md:px-12">
        <AnimateIn className="max-w-[760px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Services</span>
          <h1 className="mt-2 font-syne text-[clamp(38px,7vw,76px)] font-extrabold leading-none tracking-[-0.03em]">
            Commercial web builds, not template theatre.
          </h1>
          <p className="mt-5 font-dm text-lg leading-relaxed text-t2">
            ScaleSmiths builds the public site, sales funnel, technical system, and care plan around the business outcome.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/quote" prefetch={false} className="btn-primary font-dm">Request a Quote <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/pricing" prefetch={false} className="btn-ghost font-dm">View Pricing Guidance</Link>
          </div>
        </AnimateIn>
      </section>

      <section className="px-6 pb-20 md:px-12">
        <div className="mx-auto grid max-w-[1240px] gap-3 md:grid-cols-2">
          {serviceHubItems.map((service) => (
            <article key={service.title} className="rounded-2xl border border-b1 bg-s1 p-6">
              <h2 className="font-syne text-2xl font-bold">{service.title}</h2>
              <div className="mt-5 grid gap-4">
                {[
                  ["Who it is for", service.for],
                  ["Included", service.includes],
                  ["Typical outcome", service.outcome],
                ].map(([label, copy]) => (
                  <div key={label} className="flex gap-3">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-grn" aria-hidden="true" />
                    <div>
                      <div className="font-dm text-[11px] font-semibold uppercase tracking-[.08em] text-t3">{label}</div>
                      <p className="mt-1 font-dm text-sm leading-relaxed text-t2">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/quote" prefetch={false} className="btn-primary font-dm text-sm">Request a Quote</Link>
                {service.links.map((href) => (
                  <Link key={href} href={href} prefetch={false} className="btn-ghost font-dm text-sm">{href.replace("/", "").replaceAll("-", " ")}</Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <CTA />
    </>
  )
}
