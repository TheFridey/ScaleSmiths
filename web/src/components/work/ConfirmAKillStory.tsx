import Link from "next/link"
import { ArrowRight, BarChart3, Check, Search, Workflow } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"

const baseline = [
  { value: "57.9K", label: "Organic impressions" },
  { value: "192", label: "Organic clicks" },
  { value: "0.3%", label: "Search CTR" },
  { value: "15.6", label: "Average position" },
]

const platformLayers = [
  {
    icon: Search,
    title: "Search architecture",
    copy: "Canonical routes, crawlable service pages, preserved advice URLs, metadata, sitemap and robots controls, structured data and deliberate internal links.",
  },
  {
    icon: BarChart3,
    title: "Measurement",
    copy: "Consent-aware first-party events and GA4 readiness provide a clean post-launch measurement layer without combining paid advertising with organic Search Console data.",
  },
  {
    icon: Workflow,
    title: "Operations",
    copy: "A private, role-controlled CRM supports enquiries, customers, properties, quotations, appointments, jobs, visits and commercial service records behind the public site.",
  },
]

export function ConfirmAKillStory() {
  return (
    <>
      <section aria-labelledby="cak-baseline" className="border-y border-b1 bg-s1/40 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
            <div>
              <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">The existing opportunity</p>
              <h2 id="cak-baseline" className="mt-2 font-syne text-[clamp(30px,4vw,48px)] font-extrabold tracking-[-.03em]">Visible in search. Rarely chosen.</h2>
              <p className="mt-5 font-dm text-base leading-relaxed text-t2">
                Before launch, Confirm-A-Kill was already appearing frequently in Google Search, generating 57.9K impressions over three months. Only 0.3% of those impressions converted into organic clicks, exposing a clear opportunity to improve search-result relevance and the journey after the click.
              </p>
              <p className="mt-4 font-dm text-sm leading-relaxed text-t3">
                The business was also spending approximately £1,000 per month on advertising. That paid activity is separate from the organic Search Console figures shown here.
              </p>
            </div>
            <div>
              <p className="mb-4 font-dm text-[11px] font-semibold uppercase tracking-[.14em] text-t3">Previous website — 3 month Google Search Console baseline</p>
              <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-b1 bg-bg md:grid-cols-4">
                {baseline.map((item) => (
                  <div key={item.label} className="border-b border-r border-b1 p-5 last:border-r-0 md:p-6">
                    <dd className="font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-.04em] text-t1">{item.value}</dd>
                    <dt className="mt-2 font-dm text-xs leading-relaxed text-t3">{item.label}</dt>
                  </div>
                ))}
              </dl>
              <p className="mt-4 font-dm text-xs leading-relaxed text-t3">Post-launch performance is now being measured against this pre-launch baseline. No post-launch uplift is claimed yet.</p>
            </div>
          </AnimateIn>
        </div>
      </section>

      <section aria-labelledby="cak-platform" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn className="max-w-[780px]">
            <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">More than a website</p>
            <h2 id="cak-platform" className="mt-2 font-syne text-[clamp(30px,4vw,48px)] font-extrabold tracking-[-.03em]">The public experience and the operating system behind it.</h2>
            <p className="mt-5 font-dm text-lg leading-relaxed text-t2">The rebuild connects customer intent, search content, enquiry capture, measurement and day-to-day delivery. It is a working platform for a real pest-control business, not a collection of redesigned pages.</p>
          </AnimateIn>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {platformLayers.map(({ icon: Icon, title, copy }, index) => (
              <AnimateIn key={title} delay={index * 0.05} className="rounded-2xl border border-b1 bg-s1/40 p-6 md:p-7">
                <Icon size={22} className="text-acc" aria-hidden="true" />
                <h3 className="mt-5 font-syne text-xl font-bold">{title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{copy}</p>
              </AnimateIn>
            ))}
          </div>
          <AnimateIn className="mt-8 rounded-2xl border border-acc/20 bg-acc/[.05] p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Ongoing Growth Partnership</p>
                <h3 className="mt-2 font-syne text-2xl font-bold">Launch is the measurement point, not the finish line.</h3>
                <p className="mt-3 max-w-[780px] font-dm text-sm leading-relaxed text-t2">Under the £350/month Growth Partnership, ScaleSmiths continues to monitor Search Console and analytics, improve content and conversion journeys, maintain the platform, and support deployment and infrastructure as priorities evolve.</p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {["Search and analytics monitoring", "Content and technical SEO", "Conversion improvements", "Maintenance and deployment support"].map((item) => <li key={item} className="flex items-center gap-2 font-dm text-sm text-t1"><Check size={14} className="text-acc" aria-hidden="true" />{item}</li>)}
                </ul>
              </div>
              <Link href="/digital-growth-partnership" prefetch={false} className="btn-ghost w-fit font-dm">How the partnership works <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      <section aria-labelledby="cak-status" className="border-y border-b1 bg-s1/40 px-6 py-20 md:px-12">
        <AnimateIn className="mx-auto max-w-[1240px] text-center">
          <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Current status</p>
          <h2 id="cak-status" className="mt-3 font-syne text-[clamp(38px,7vw,76px)] font-extrabold tracking-[-.045em]">Live. Measured. Improving.</h2>
          <p className="mx-auto mt-5 max-w-[720px] font-dm text-base leading-relaxed text-t2">The platform is in production. Post-launch search and conversion data is now accumulating, while the website, content and operating systems continue to improve under the Growth Partnership.</p>
        </AnimateIn>
      </section>
    </>
  )
}
