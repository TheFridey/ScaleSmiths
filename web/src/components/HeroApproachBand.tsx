import Link from "next/link"
import { ArrowRight } from "lucide-react"

const PROBLEMS = [
  {
    title: "Customer journeys no longer match the organisation",
    body: "The public site, enquiry paths or service explanations lag how the business actually sells and delivers.",
  },
  {
    title: "Operational friction sits behind the website",
    body: "Enquiries arrive incomplete, details are retyped, or staff work around systems that were never designed to connect.",
  },
  {
    title: "The estate has outgrown a brochure build",
    body: "Multi-site, multi-offer or integration-heavy work needs architecture and scoping, not another template refresh.",
  },
  {
    title: "A larger brief needs a straight answer",
    body: "You need platforms, migrations or corporate digital work discussed properly, including what ScaleSmiths should not take on.",
  },
] as const

const BUYERS = [
  {
    title: "Independent and growing businesses",
    body: "Websites, visibility and Growth Partnerships with transparent starting prices and agreed scope before work starts.",
    href: "/pricing#web-growth",
    label: "Business Websites & Growth",
  },
  {
    title: "Established and multi-site organisations",
    body: "Corporate websites, journey architecture, integrations and digital transformation scoped around real objectives.",
    href: "/enterprise-websites",
    label: "Enterprise websites",
  },
  {
    title: "Complex platforms and operations",
    body: "Bespoke systems, workflows, security and migrations discussed with the founders and scoped after discovery.",
    href: "/enterprise",
    label: "Enterprise systems",
  },
] as const

const ACTIONS = [
  { href: "/quote?intent=strategy_call", label: "Discuss a Project" },
  { href: "/services", label: "Explore Our Capabilities" },
  { href: "/digital-growth-partnership", label: "Growth Partnership" },
  { href: "/work#engineering-complex-systems", label: "Engineering & Complex Systems" },
] as const

/**
 * Sits under the forge hero. Commercial clarity and buyer fit come before
 * published starting prices, which live on /pricing rather than as a homepage retail grid.
 */
export function HeroApproachBand({ verifiedStats = [] }: { verifiedStats?: string[] }) {
  return (
    <section aria-labelledby="commercial-clarity-heading" className="relative border-b border-b1 bg-s1/70 px-6 py-16 md:px-12 md:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acc/40 to-transparent"
      />
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">What we help with</p>
          <h2 id="commercial-clarity-heading" className="mt-3 max-w-[20ch] font-syne text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.02] tracking-[-0.03em]">
            Far more than a basic website build.
          </h2>
          <p className="mt-5 max-w-[62ch] font-dm text-base leading-relaxed text-t2">
            ScaleSmiths designs digital experiences, intelligent systems and measurable growth work for independent businesses and established organisations. Trevor and Rhys founded the company and own it equally. You deal with the people who decide and deliver.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {PROBLEMS.map((problem) => (
              <li key={problem.title} className="rounded-2xl border border-b1 bg-bg/80 p-5">
                <h3 className="font-syne text-lg font-bold tracking-[-0.02em]">{problem.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{problem.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <aside aria-labelledby="home-buyer-fit" className="rounded-3xl border border-b1 bg-bg p-6 md:p-8">
          <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Find the right conversation</p>
          <h2 id="home-buyer-fit" className="mt-2 font-syne text-2xl font-extrabold tracking-[-0.02em]">
            The same company. A different starting point.
          </h2>
          <ul className="mt-6 grid gap-4">
            {BUYERS.map((buyer) => (
              <li key={buyer.title} className="border-t border-b1 pt-4 first:border-t-0 first:pt-0">
                <h3 className="font-syne text-base font-bold">{buyer.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{buyer.body}</p>
                <Link href={buyer.href} prefetch={false} className="mt-3 inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
                  {buyer.label} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="mx-auto mt-12 max-w-[1240px] border-t border-b1 pt-8">
        <h2 className="font-syne text-xl font-bold">Work you can inspect</h2>
        <p className="mt-3 max-w-[78ch] font-dm text-sm leading-relaxed text-t2">
          Confirm-A-Kill is a live pest-control website and operating system. The Search Console figures on that case study are the previous site&apos;s baseline. Post-launch performance is being compared with that baseline under the client&apos;s Growth Partnership. Complex platforms such as Prymal, VeteranFinder and The Business Circle sit in Engineering &amp; Complex Systems.
        </p>
        {verifiedStats.length > 0 ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Verified public claim">
            {verifiedStats.map((statement) => (
              <li key={statement} className="max-w-[18rem]">
                <p className="font-syne text-base font-semibold leading-snug text-t1">{statement}</p>
                <p className="mt-2 font-dm text-xs tracking-[0.04em] text-t3">Recorded public figure</p>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          {ACTIONS.map((action, index) => (
            <Link key={action.href} href={action.href} prefetch={false} className={index === 0 ? "btn-primary font-dm" : "btn-ghost font-dm"}>
              {action.label}
              {index === 0 ? <ArrowRight size={16} aria-hidden="true" /> : null}
            </Link>
          ))}
        </div>
        <p className="mt-5 font-dm text-xs leading-relaxed text-t3">
          Transparent SME starting prices remain on the{" "}
          <Link href="/pricing#published-prices" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
            pricing page
          </Link>
          . They are not the measure of every engagement.
        </p>
      </div>
    </section>
  )
}
