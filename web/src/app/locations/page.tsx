import Link from "next/link"
import { ArrowRight, MapPin } from "lucide-react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { buildPageMetadata } from "@/lib/page-metadata"
import { BUSINESS_LOCATION, SERVICE_AREA_STATEMENT, siteBaseUrl } from "@/lib/site-identity"
import { buildBreadcrumbSchema, buildWebPageSchema } from "@/lib/structured-data"

const description = "ScaleSmiths is based in Hucknall, Nottinghamshire, delivering web design, development and digital growth work locally and across the UK."
const locationPages = [
  { href: "/locations/nottingham", title: "Nottingham", description: "A regional hub for website, SEO, development and automation services across Nottingham and Nottinghamshire." },
  { href: "/locations/hucknall", title: "Hucknall", description: "ScaleSmiths' home base, nearby published work and services for local businesses." },
  { href: "/web-design-hucknall", title: "Web design in Hucknall", description: "Local website and growth support from the town where ScaleSmiths is based." },
  { href: "/web-design-nottingham", title: "Web design in Nottingham", description: "Conversion-focused websites for Nottingham service businesses." },
  { href: "/web-development-nottingham", title: "Web development in Nottingham", description: "Custom web engineering, integrations and platform work." },
  { href: "/e-commerce-development-nottingham", title: "E-commerce development in Nottingham", description: "Storefronts, operations and integrations built around the business." },
]

export const metadata = buildPageMetadata({ title: "Locations & Service Areas", description, path: "/locations" })

export default function LocationsPage() {
  const base = siteBaseUrl()
  return (
    <>
      <JsonLd data={[
        buildWebPageSchema(base, { name: "ScaleSmiths locations and service areas", description, path: "/locations", type: "CollectionPage" }),
        buildBreadcrumbSchema(base, [{ name: "Home", path: "/" }, { name: "Locations", path: "/locations" }]),
      ]} />
      <main className="px-6 pb-24 pt-10 md:px-12 md:pt-14">
        <div className="mx-auto max-w-[1240px]">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Locations" }]} />
          <header className="mt-10 max-w-[850px]">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-acc"><MapPin size={14} aria-hidden="true" /> {BUSINESS_LOCATION.locality}, {BUSINESS_LOCATION.region}</p>
            <h1 className="mt-3 font-syne text-[clamp(38px,6.5vw,72px)] font-black leading-[1.02] tracking-[-.04em]">Local knowledge, UK-wide delivery.</h1>
            <p className="mt-5 text-lg leading-relaxed text-t2">{description} {SERVICE_AREA_STATEMENT}.</p>
          </header>
          <section aria-labelledby="location-pages" className="mt-14">
            <h2 id="location-pages" className="font-syne text-3xl font-bold">Location-specific services</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {locationPages.map((page) => <Link key={page.href} href={page.href} prefetch={false} className="group rounded-2xl border border-b1 bg-s1 p-6 transition-colors hover:border-b2"><h3 className="font-syne text-xl font-bold">{page.title}</h3><p className="mt-2 text-sm leading-relaxed text-t2">{page.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-acc">Explore <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span></Link>)}
            </div>
          </section>
          <section aria-labelledby="location-next" className="mt-16 grid gap-8 rounded-3xl border border-acc/20 bg-acc/[.05] p-8 md:p-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Where to go next</p>
              <h2 id="location-next" className="mt-2 font-syne text-[clamp(26px,3.4vw,38px)] font-extrabold tracking-[-.03em]">Not in Nottinghamshire?</h2>
              <p className="mt-4 max-w-[560px] text-sm leading-relaxed text-t2">
                Location hubs exist where we have local work to point at. Everything else runs remotely with a review cadence agreed in the scope — see the{" "}
                <Link href="/work" prefetch={false} className="text-t1 underline decoration-acc underline-offset-4">case studies</Link> or the{" "}
                <Link href="/faq#commercial" prefetch={false} className="text-t1 underline decoration-acc underline-offset-4">questions about working together</Link>.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/quote" prefetch={false} className="btn-primary">Discuss a project <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/services" prefetch={false} className="btn-ghost">Explore services</Link>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
