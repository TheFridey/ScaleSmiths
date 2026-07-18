import type { Metadata } from "next"
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react"
import { LocalGrowthCheckForm, LocalGrowthFullQuoteLink, LocalGrowthStrategyCallLink } from "@/components/LocalGrowthCheckForm"

export const metadata: Metadata = {
  title: "Local Growth Check for Nottinghamshire Businesses",
  description: "A founder-led first review for local and referral businesses that want a clearer view of their website, visibility, trust, or enquiry journey.",
  alternates: { canonical: "/local-growth-check" },
  openGraph: {
    title: "Local Growth Check | ScaleSmiths",
    description: "A focused, no-obligation first review for local businesses from ScaleSmiths in Hucknall, Nottinghamshire.",
    url: "/local-growth-check",
  },
}

export default function LocalGrowthCheckPage() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk").replace(/\/$/, "")
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "ScaleSmiths Local Growth Check",
      url: `${baseUrl}/local-growth-check`,
      description: metadata.description,
      isPartOf: { "@type": "WebSite", name: "ScaleSmiths", url: baseUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Local Growth Check",
      serviceType: "Website and digital growth review",
      provider: { "@id": `${baseUrl}/#org` },
      areaServed: ["Hucknall", "Nottinghamshire", "United Kingdom"],
      url: `${baseUrl}/local-growth-check`,
      description: "A founder-led review of a business's public website or social presence, enquiry path, trust signals, and local discoverability.",
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="mx-auto max-w-[1180px] px-6 py-14 md:px-12 md:py-20">
        <header className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-acc/25 bg-acc/10 px-3 py-1.5 font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">
            <MapPin size={13} aria-hidden="true" /> Hucknall &amp; Nottinghamshire
          </div>
          <h1 className="mt-6 font-syne text-[clamp(38px,6vw,68px)] font-black leading-[1.02] tracking-[-.04em]">A useful first look at what is holding your local growth back.</h1>
          <p className="mt-6 max-w-2xl font-dm text-lg leading-relaxed text-t2">
            Share the main problem in a few lines. A ScaleSmiths founder will review the public information available and identify a sensible next step—without assuming you need to commission a full website build.
          </p>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
          <div className="space-y-7">
            <section aria-labelledby="review-heading" className="rounded-2xl border border-b1 bg-s1 p-6">
              <h2 id="review-heading" className="font-syne text-2xl font-extrabold">What we will review</h2>
              <ul className="mt-5 space-y-3 font-dm text-sm leading-relaxed text-t2">
                {["How clearly your offer and location are communicated", "Whether mobile visitors can find a confident next step", "Trust, contact, and enquiry friction visible from public pages", "Obvious local-search and content gaps worth investigating"].map((item) => (
                  <li key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-acc" aria-hidden="true" />{item}</li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="findings-heading" className="rounded-2xl border border-b1 p-6">
              <h2 id="findings-heading" className="font-syne text-xl font-extrabold">Useful findings might include</h2>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">A confusing call to action, missing service-area context, weak mobile contact routes, inconsistent business details, or a page that does not answer the buyer&apos;s first question. Findings depend on the public information available.</p>
            </section>

            <section aria-labelledby="local-proof-heading" className="rounded-2xl border border-acc/20 bg-acc/[.06] p-6">
              <h2 id="local-proof-heading" className="font-syne text-xl font-extrabold">Local, founder-led, and practical</h2>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">ScaleSmiths is based in Hucknall, Nottinghamshire. We build websites and digital systems for local businesses and wider UK organisations, so the review considers both local discovery and the commercial job your site needs to do.</p>
            </section>

            <div className="flex flex-wrap items-center gap-3 font-dm text-sm text-t2">
              <span>Already know what you need?</span>
              <LocalGrowthFullQuoteLink className="inline-flex items-center gap-1 font-semibold text-acc hover:text-t1">Use the full quote route <ArrowRight size={14} aria-hidden="true" /></LocalGrowthFullQuoteLink>
              <span aria-hidden="true">·</span>
              <LocalGrowthStrategyCallLink className="font-semibold text-acc hover:text-t1" />
            </div>
          </div>

          <LocalGrowthCheckForm />
        </div>
      </div>
    </>
  )
}
