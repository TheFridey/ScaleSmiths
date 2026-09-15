import Link from "next/link"
import { ArrowRight, ChevronRight, Mail, MapPin } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { JsonLd } from "@/components/JsonLd"
import { founderProfileHref, founders } from "@/lib/founders"
import { buildPageMetadata } from "@/lib/page-metadata"
import {
  BUSINESS_LOCATION,
  CONTACT_EMAIL,
  SERVICE_AREA_STATEMENT,
  organizationId,
  organizationProfiles,
  siteBaseUrl,
  websiteId,
} from "@/lib/site-identity"
import { buildBreadcrumbSchema } from "@/lib/structured-data"

export const metadata = buildPageMetadata({
  title: "Contact",
  description: `Contact ScaleSmiths in ${BUSINESS_LOCATION.locality}, ${BUSINESS_LOCATION.region}. Start a project brief, request a strategy call or email the founders directly.`,
  path: "/contact",
})

const routes = [
  { title: "Start a project brief", description: "Share the goal, scope and constraints so we can come back with a considered view.", href: "/quote" },
  { title: "Request a strategy call", description: "Talk the problem through with a founder before anything is scoped.", href: "/quote?intent=strategy_call" },
  { title: "Business Growth Audit", description: "Not sure what needs fixing first? Start with a structured diagnosis.", href: "/services/business-growth-audit" },
  { title: "Existing client portal", description: "Log requests and follow active work if you are already a client.", href: "/portal/login" },
]

export default function ContactPage() {
  const base = siteBaseUrl()
  const profiles = organizationProfiles()
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "Contact ScaleSmiths",
      url: `${base}/contact`,
      isPartOf: { "@id": websiteId(base) },
      about: { "@id": organizationId(base) },
    },
    buildBreadcrumbSchema(base, [
      { name: "Home", path: "/" },
      { name: "Contact", path: "/contact" },
    ]),
  ]

  return (
    <>
      <JsonLd data={schema} />
      <section className="px-6 pb-20 pt-10 md:px-12 md:pb-28 md:pt-14">
        <div className="mx-auto max-w-[1240px]">
          <nav aria-label="Breadcrumb" className="font-dm text-xs text-t3">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link href="/" className="hover:text-t1">Home</Link></li>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li aria-current="page" className="text-t1">Contact</li>
            </ol>
          </nav>

          <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_.9fr]">
            <AnimateIn>
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Contact</span>
              <h1 className="mt-3 font-syne text-[clamp(38px,6.5vw,72px)] font-black leading-[1.02] tracking-[-.04em]">Speak directly to the founders.</h1>
              <p className="mt-6 max-w-[620px] font-dm text-lg leading-relaxed text-t2">
                Every enquiry is read by {founders.map((founder) => founder.name).join(" and ")}. Choose the route that fits where you are, or email us directly.
              </p>

              <ul className="mt-10 grid gap-2">
                {routes.map((route) => (
                  <li key={route.href}>
                    <Link href={route.href} prefetch={false} className="group flex items-start justify-between gap-4 rounded-2xl border border-b1 bg-s1 p-5 transition-colors hover:border-b2">
                      <span>
                        <span className="block font-syne text-lg font-bold">{route.title}</span>
                        <span className="mt-1 block font-dm text-sm leading-relaxed text-t2">{route.description}</span>
                      </span>
                      <ArrowRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-t3 transition-transform group-hover:translate-x-1 group-hover:text-acc" />
                    </Link>
                  </li>
                ))}
              </ul>
            </AnimateIn>

            <AnimateIn delay={0.06}>
              <aside aria-label="Business details" className="rounded-2xl border border-acc/25 bg-acc/[.06] p-6 md:p-8">
                <h2 className="font-syne text-2xl font-bold">ScaleSmiths</h2>
                <address className="mt-5 grid gap-4 font-dm text-sm not-italic text-t2">
                  <p className="flex items-start gap-3">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-acc" aria-hidden="true" />
                    <span>{BUSINESS_LOCATION.locality}, {BUSINESS_LOCATION.region}<br />{SERVICE_AREA_STATEMENT}</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <Mail size={16} className="mt-0.5 shrink-0 text-acc" aria-hidden="true" />
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-t1 underline-offset-4 hover:underline">{CONTACT_EMAIL}</a>
                  </p>
                </address>

                <div className="mt-7 border-t border-b1 pt-6">
                  <h3 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">The founders</h3>
                  <ul className="mt-4 grid gap-3">
                    {founders.map((founder) => (
                      <li key={founder.slug}>
                        <Link href={founderProfileHref(founder)} prefetch={false} className="group block">
                          <span className="block font-syne text-base font-bold group-hover:text-acc">{founder.name}</span>
                          <span className="block font-dm text-sm text-t2">{founder.role.text}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {profiles.length > 0 ? (
                  <div className="mt-7 border-t border-b1 pt-6">
                    <h3 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Find us online</h3>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {profiles.map((profile) => (
                        <li key={profile.href}>
                          <a href={profile.href} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border border-b2 px-3 py-1.5 font-dm text-sm text-t2 hover:text-t1">{profile.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </aside>
            </AnimateIn>
          </div>
        </div>
      </section>
    </>
  )
}
