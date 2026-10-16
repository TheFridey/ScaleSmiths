import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  STARTING_PRICE_BOUNDARY,
  publishedStartingPrices,
} from "@/lib/published-starting-prices"

const PROBLEMS = [
  {
    title: "The right enquiries are not coming",
    body: "The website, the way you are found, or the path people use to get in touch is losing work you should be winning.",
  },
  {
    title: "Staff time is disappearing into admin",
    body: "Enquiries arrive incomplete, the same details are typed in twice, or the site is too awkward to keep up to date.",
  },
  {
    title: "The digital journey does not match the business",
    body: "A growing company has outgrown a brochure site, a stack of tools, or a process that only works when one person remembers it.",
  },
  {
    title: "A larger brief needs a straight answer",
    body: "You need platforms, integrations or a migration discussed properly, including what ScaleSmiths should not take on.",
  },
] as const

const BUYERS = [
  {
    title: "Smaller businesses",
    body: "A professionally scoped website, a one-time audit, or business email. The starting point is published. The scope is agreed before work starts.",
    href: "/services",
    label: "See the services",
  },
  {
    title: "Growing companies",
    body: "Better enquiries, a website that can keep up, and a partnership that improves the work month by month.",
    href: "/digital-growth-partnership",
    label: "Explore a partnership",
  },
  {
    title: "Established organisations",
    body: "Bespoke platforms, integrations and operational systems, discussed with the founders and scoped to the requirement.",
    href: "/enterprise",
    label: "Discuss a larger brief",
  },
] as const

const ACTIONS = [
  { href: "/quote?intent=strategy_call", label: "Discuss My Business" },
  { href: "/quote", label: "Get a Website Quote" },
  { href: "/digital-growth-partnership", label: "Explore Growth Partnerships" },
  { href: "/services/business-growth-audit", label: "Request a Business Audit" },
] as const

/**
 * Sits under the forge hero. Outcomes and fit come before the published
 * starting prices, which stay visible and unchanged.
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
          <h2 id="commercial-clarity-heading" className="mt-3 max-w-[18ch] font-syne text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.02] tracking-[-0.03em]">
            Better enquiries. Less wasted effort.
          </h2>
          <p className="mt-5 max-w-[62ch] font-dm text-base leading-relaxed text-t2">
            ScaleSmiths helps businesses attract the right customers, improve the websites that support them, and reduce the admin that sits between an enquiry and the work. Trevor and Rhys founded the company and own it equally. You deal with the people who decide and deliver.
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

      <div id="published-prices" className="mx-auto mt-12 max-w-[1240px] rounded-3xl border border-b1 bg-bg/70 p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Published starting points</p>
            <h2 id="home-starting-prices" className="mt-2 font-syne text-2xl font-extrabold tracking-[-0.02em]">
              Entry prices, not the size of the company.
            </h2>
          </div>
          <Link href="/pricing#published-prices" prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
            Read the pricing guidance <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 max-w-[70ch] font-dm text-sm leading-relaxed text-t2">
          These figures are genuine places to start. A complex website, a larger partnership, or a bespoke system is quoted from the scope. A low starting price is not a ceiling, and it is not a description of every project.
        </p>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {publishedStartingPrices.map((item) => (
            <li key={item.id} className="rounded-2xl border border-b1 bg-s1/50 p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-syne text-base font-bold">{item.name}</h3>
                <p className="shrink-0 font-syne text-base font-bold text-acc">{item.priceLabel}</p>
              </div>
              <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-5 font-dm text-xs leading-relaxed text-t3">{STARTING_PRICE_BOUNDARY}</p>
      </div>

      <div className="mx-auto mt-12 max-w-[1240px] border-t border-b1 pt-8">
        <h2 className="font-syne text-xl font-bold">Work you can inspect</h2>
        <p className="mt-3 max-w-[78ch] font-dm text-sm leading-relaxed text-t2">
          Confirm-A-Kill is a live pest-control website and operating system. The Search Console figures on that case study are the previous site&apos;s baseline. Post-launch performance is being compared with that baseline under the client&apos;s Growth Partnership.
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
      </div>
    </section>
  )
}
