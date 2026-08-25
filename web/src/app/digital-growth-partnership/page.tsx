import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BarChart3, CheckCircle2, Search, ShieldCheck, Wrench } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { CTA } from "@/components/CTA"

export const metadata: Metadata = {
  title: "Digital Growth Partnership",
  description: "An ongoing digital growth partnership for website improvements, SEO, conversion optimisation, content, analytics, automation and managed technical support.",
  alternates: { canonical: "/digital-growth-partnership" },
  openGraph: {
    title: "Digital Growth Partnership | ScaleSmiths",
    description: "Ongoing website, SEO, conversion, automation and technical improvement with one accountable digital partner.",
    url: "/digital-growth-partnership",
  },
}

const capabilities = [
  { title: "Search visibility", body: "Technical SEO, service and location content, internal linking, search-intent coverage and Search Console review.", Icon: Search },
  { title: "Conversion improvement", body: "Clearer journeys, stronger calls to action, landing-page refinement and evidence-led friction reduction.", Icon: BarChart3 },
  { title: "Website evolution", body: "Planned content, UX and feature improvements without waiting for another full rebuild.", Icon: Wrench },
  { title: "Technical stewardship", body: "Maintenance, monitoring, deployment support and practical ownership of the agreed digital estate.", Icon: ShieldCheck },
]

const faq = [
  { q: "Is a Digital Growth Partnership the same as website maintenance?", a: "Maintenance can be part of it, but the partnership is broader. The agreed scope may combine technical care with SEO, content, conversion work, analytics, automation and roadmap delivery." },
  { q: "Do I need a new ScaleSmiths website first?", a: "Not necessarily. We first assess the current website, access, technology, risks and growth priorities. Any takeover or improvement work is scoped before the partnership begins." },
  { q: "What is included each month?", a: "The proposal defines priorities, working cadence, responsibilities and commercial terms. Work is deliberately scoped around the business rather than presented as an unlimited or generic package." },
]

export default function DigitalGrowthPartnershipPage() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk").replace(/\/$/, "")
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Digital Growth Partnership",
      serviceType: "Ongoing digital growth, SEO, conversion optimisation and web development",
      url: `${baseUrl}/digital-growth-partnership`,
      provider: { "@type": "Organization", "@id": `${baseUrl}/#org`, name: "ScaleSmiths" },
      areaServed: ["Nottingham", "Nottinghamshire", "United Kingdom"],
      description: metadata.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="mx-auto max-w-[1240px] px-6 py-20 md:px-12 md:py-28">
        <AnimateIn className="max-w-[900px]">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Grow with one accountable partner</p>
          <h1 className="mt-3 font-syne text-[clamp(42px,8vw,88px)] font-extrabold leading-[.92] tracking-[-.04em]">Your Digital Growth Partnership.</h1>
          <p className="mt-7 max-w-[760px] text-lg leading-relaxed text-t2">A Digital Growth Partnership can begin with an existing website or infrastructure, or continue after a ScaleSmiths build. We continually improve the digital estate across search visibility, conversion, content, automation and technical delivery—within an agreed, prioritised roadmap.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link href="/quote" className="btn-primary">Discuss a Partnership <ArrowRight size={16} /></Link><Link href="/work" className="btn-ghost">See Our Work</Link></div>
        </AnimateIn>
      </section>

      <section className="border-y border-b1 bg-s1 px-6 py-24 md:px-12" aria-labelledby="partnership-capabilities">
        <div className="mx-auto max-w-[1240px]"><AnimateIn className="max-w-[720px]"><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Connected capability</p><h2 id="partnership-capabilities" className="mt-3 font-syne text-[clamp(34px,6vw,60px)] font-extrabold">More than keeping the lights on.</h2><p className="mt-5 leading-relaxed text-t2">The exact mix follows the agreed roadmap. These are the core areas a partnership can bring together.</p></AnimateIn><div className="mt-12 grid gap-4 md:grid-cols-2">{capabilities.map(({ title, body, Icon }) => <AnimateIn key={title} className="rounded-2xl border border-b1 bg-bg p-7"><Icon size={20} className="text-acc" aria-hidden="true" /><h3 className="mt-5 font-syne text-2xl font-bold">{title}</h3><p className="mt-3 leading-relaxed text-t2">{body}</p></AnimateIn>)}</div></div>
      </section>

      <section className="px-6 py-24 md:px-12"><div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[.75fr_1.25fr]"><AnimateIn><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">How it works</p><h2 className="mt-3 font-syne text-[clamp(34px,5vw,56px)] font-extrabold">One roadmap. Clear priorities.</h2></AnimateIn><div className="grid gap-3">{["Understand the commercial goals, current performance and technical constraints.", "Agree priorities, responsibilities, cadence and a deliberately bounded scope.", "Deliver, measure and review the work against useful business signals.", "Reprioritise the roadmap as evidence and business needs change."].map((item, index) => <div key={item} className="flex gap-4 border-t border-b1 py-5"><CheckCircle2 size={17} className="mt-1 shrink-0 text-success" aria-hidden="true" /><div><span className="text-xs text-t3">0{index + 1}</span><p className="mt-1 leading-relaxed text-t2">{item}</p></div></div>)}</div></div></section>

      <section className="border-t border-b1 bg-s1 px-6 py-24 md:px-12"><div className="mx-auto max-w-[980px]"><h2 className="font-syne text-[clamp(32px,5vw,52px)] font-extrabold">Digital Growth Partnership FAQs</h2><div className="mt-9 divide-y divide-b1">{faq.map((item) => <article key={item.q} className="py-6"><h3 className="font-syne text-xl font-bold">{item.q}</h3><p className="mt-3 leading-relaxed text-t2">{item.a}</p></article>)}</div></div></section>
      <CTA />
    </>
  )
}
