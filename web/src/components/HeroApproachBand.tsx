import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  STARTING_PRICE_BOUNDARY,
  publishedStartingPrices,
} from "@/lib/published-starting-prices"

const PROBLEMS = [
  {
    title: "The enquiries are not coming",
    body: "You need more customers and you are not sure whether the gap is the website, visibility, or the way people get in touch.",
  },
  {
    title: "The work around the website is wasting time",
    body: "An established business is losing hours to a site that is hard to update, enquiries that arrive incomplete, or admin that still lives in inboxes.",
  },
  {
    title: "You are comparing suppliers",
    body: "You want a clear offer, a responsible starting price, and proof that says what was actually delivered.",
  },
  {
    title: "You are outside the UK",
    body: "You can work with us remotely. We are based in Hucknall and do not claim offices or local expertise we do not have.",
  },
] as const

const ACTIONS = [
  { href: "/quote?intent=strategy_call", label: "Discuss My Business" },
  { href: "/quote", label: "Get a Website Quote" },
  { href: "/digital-growth-partnership", label: "Explore Growth Partnerships" },
  { href: "/services/business-growth-audit", label: "Request a Business Audit" },
] as const

/**
 * Sits under the forge hero so the first scroll answers what we do, which
 * problems we take on, why the proof is trustworthy, what it might cost, and
 * what to do next. Verified public claims, when present, stay labelled as such.
 */
export function HeroApproachBand({ verifiedStats = [] }: { verifiedStats?: string[] }) {
  return (
    <section aria-labelledby="commercial-clarity-heading" className="relative border-b border-b1 bg-s1/70 px-6 py-16 md:px-12 md:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acc/40 to-transparent"
      />
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div>
          <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Find what is holding growth back</p>
          <h2 id="commercial-clarity-heading" className="mt-3 max-w-[18ch] font-syne text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.02] tracking-[-0.03em]">
            A clearer business, not another vague package.
          </h2>
          <p className="mt-5 max-w-[62ch] font-dm text-base leading-relaxed text-t2">
            ScaleSmiths helps businesses attract customers, improve their websites, become more visible online, simplify operations and increase commercial effectiveness. Trevor and Rhys founded the company and own it equally. The work starts with the constraint in front of you.
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

        <aside id="published-prices" aria-labelledby="home-starting-prices" className="rounded-3xl border border-acc/30 bg-bg p-6 md:p-8">
          <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">What it might cost</p>
          <h2 id="home-starting-prices" className="mt-2 font-syne text-2xl font-extrabold tracking-[-0.02em]">
            Published starting prices
          </h2>
          <ul className="mt-6 divide-y divide-b1">
            {publishedStartingPrices.map((item) => (
              <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-syne text-base font-bold">{item.name}</h3>
                  <p className="shrink-0 font-syne text-base font-bold text-acc">{item.priceLabel}</p>
                </div>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 font-dm text-xs leading-relaxed text-t3">{STARTING_PRICE_BOUNDARY}</p>
          <Link href="/pricing#published-prices" prefetch={false} className="mt-5 inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
            Read the pricing guidance <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <div className="mx-auto mt-12 max-w-[1240px] border-t border-b1 pt-8">
        <h2 className="font-syne text-xl font-bold">Why the proof is narrow on purpose</h2>
        <p className="mt-3 max-w-[78ch] font-dm text-sm leading-relaxed text-t2">
          Confirm-A-Kill is completed work: a live pest-control website and operating system. The published Search Console figures are the previous site&apos;s baseline, not a result we are claiming for the rebuild. Post-launch performance is still being monitored under the Growth Partnership. We do not invent testimonials, rankings or overseas client results.
        </p>
        {verifiedStats.length > 0 ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Verified public claim">
            {verifiedStats.map((statement) => (
              <li key={statement} className="max-w-[18rem]">
                <p className="font-syne text-base font-semibold leading-snug text-t1">{statement}</p>
                <p className="mt-2 font-dm text-xs tracking-[0.04em] text-t3">Verified public claim</p>
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
