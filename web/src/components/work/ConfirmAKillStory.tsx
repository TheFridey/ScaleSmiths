import Link from "next/link"
import { ArrowRight, BarChart3, Check, Search, Workflow } from "lucide-react"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
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


const scope = [
  { title: "Complete website rebuild", detail: "A full custom Astro build replacing the previous WordPress presentation — new templates, new content structure and new enquiry journeys, not a theme reskin over the same site." },
  { title: "Modern responsive front end", detail: "Mobile-first pest and service selection, with the delivered experience captured across desktop, tablet and mobile rather than described." },
  { title: "Page and service architecture", detail: "Separate domestic and commercial service journeys, Nottinghamshire coverage pages and a searchable advice hub, each with an explicit route to a quote." },
  { title: "SEO foundations", detail: "Established advice URLs preserved, canonical metadata and structured data applied across service, coverage and article routes, with a deliberate internal-link architecture between them." },
  { title: "Technical optimisation", detail: "Static-first delivery with interactivity added only where a journey needs it, so the pages that matter to search and to customers load without unnecessary weight." },
  { title: "Custom business functionality", detail: "A private, role-controlled CRM holding customers, properties, quotations, appointments, jobs, visits and commercial service records behind the public site." },
]

const launchSteps = [
  { title: "Record the baseline", detail: "Three months of Search Console data captured from the previous website, so the rebuild could later be judged against evidence rather than impression." },
  { title: "Preserve what already ranked", detail: "Established service and advice URLs mapped into the new structure before any content was rewritten." },
  { title: "Rebuild the public experience", detail: "Service, coverage, advice and quote journeys designed and built around how customers actually choose a pest-control provider." },
  { title: "Connect the operating layer", detail: "Enquiries wired into the private CRM so a new lead becomes a customer, property, quotation and job without re-keying." },
  { title: "Launch with measurement in place", detail: "Consent-aware first-party analytics and GA4 live from day one, against the recorded pre-launch baseline." },
  { title: "Improve under the partnership", detail: "Search, content, conversion and platform work continues month to month rather than stopping at handover." },
]

export function ConfirmAKillStory() {
  const siblings = caseStudiesForSlugs(["precision-finish-plastering-rendering", "glow-tanning"])
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

      <section aria-labelledby="cak-scope" className="border-t border-b1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn className="max-w-[780px]">
            <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Scope delivered</p>
            <h2 id="cak-scope" className="mt-2 font-syne text-[clamp(30px,4vw,48px)] font-extrabold tracking-[-.03em]">Everything that was actually replaced.</h2>
            <p className="mt-5 font-dm text-lg leading-relaxed text-t2">Six strands of work, delivered together. Each one is visible in the live site or the operating system behind it.</p>
          </AnimateIn>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-b1 bg-b1 md:grid-cols-2">
            {scope.map((item, index) => (
              <li key={item.title} className="bg-bg p-6 md:p-7">
                <span className="font-dm text-xs font-semibold tabular-nums text-acc">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-syne text-xl font-bold">{item.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="cak-launch" className="border-t border-b1 bg-s1/40 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[.7fr_1.3fr]">
          <AnimateIn>
            <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Launch process</p>
            <h2 id="cak-launch" className="mt-2 font-syne text-[clamp(30px,4vw,44px)] font-extrabold tracking-[-.03em]">Replacing a site that already ranked.</h2>
            <p className="mt-5 font-dm text-sm leading-relaxed text-t2">A rebuild is the moment a business is most likely to lose ground in search. The sequence below existed to make that risk manageable, and to make the result measurable afterwards.</p>
          </AnimateIn>
          <ol className="grid border-t border-b1">
            {launchSteps.map((step, index) => (
              <AnimateIn key={step.title} delay={index * 0.04} className="grid gap-2 border-b border-b1 py-5 md:grid-cols-[48px_1fr] md:gap-6">
                <span className="font-dm text-sm font-semibold tabular-nums text-acc">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-syne text-lg font-bold">{step.title}</h3>
                  <p className="mt-1.5 max-w-[640px] font-dm text-sm leading-relaxed text-t2">{step.detail}</p>
                </div>
              </AnimateIn>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="cak-status" className="border-y border-b1 bg-s1/40 px-6 py-20 md:px-12">
        <AnimateIn className="mx-auto max-w-[1240px] text-center">
          <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Current status</p>
          <h2 id="cak-status" className="mt-3 font-syne text-[clamp(38px,7vw,76px)] font-extrabold tracking-[-.045em]">Live. Measured. Improving.</h2>
          <p className="mx-auto mt-5 max-w-[720px] font-dm text-base leading-relaxed text-t2">The platform is in production. Post-launch search and conversion data is now accumulating, while the website, content and operating systems continue to improve under the Growth Partnership.</p>
        </AnimateIn>
        {siblings.length > 0 ? (
          <div className="mx-auto mt-14 max-w-[1240px]">
            <h3 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Other Nottinghamshire local-growth work</h3>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {siblings.map((study) => <ProjectCard key={study.slug} study={study} size="compact" />)}
            </div>
          </div>
        ) : null}
      </section>
    </>
  )
}
