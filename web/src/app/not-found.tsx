import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { buildPageMetadata } from "@/lib/page-metadata"

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Page not found",
    description: "That page does not exist or has moved. Find ScaleSmiths services, case studies, insights and answers from here.",
    path: "/404",
  }),
  robots: { index: false, follow: true },
}

/**
 * A 404 that does something useful. Most arrivals here come from a stale link or a mistyped URL,
 * so the page offers the four places they were most likely heading rather than a dead end with a
 * single link home.
 */
const destinations = [
  { href: "/services", title: "Services", description: "Websites, local search, custom systems, automation, hosting and ongoing partnership." },
  { href: "/work", title: "Work", description: "Case studies with the scope delivered and the systems behind each build." },
  { href: "/insights", title: "Insights", description: "Practical guides on websites, SEO, custom software and infrastructure." },
  { href: "/faq", title: "FAQ", description: "Straight answers on cost, timescales, ownership, support and how we work." },
]

export default function NotFound() {
  return (
    <div className="px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-[1000px]">
        <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Error 404</p>
        <h1 className="mt-3 font-syne text-[clamp(38px,6.5vw,72px)] font-black leading-[1.02] tracking-[-.04em]">
          That page isn&apos;t here.
        </h1>
        <p className="mt-5 max-w-[620px] font-dm text-lg leading-relaxed text-t2">
          The address is wrong, or the page has moved. Nothing has broken on your side — here is where most people are
          heading.
        </p>

        <ul className="mt-12 grid gap-3 sm:grid-cols-2">
          {destinations.map((destination) => (
            <li key={destination.href}>
              <Link
                href={destination.href}
                prefetch={false}
                className="group flex h-full flex-col rounded-2xl border border-b1 bg-s1 p-6 transition-colors hover:border-b2"
              >
                <span className="font-syne text-xl font-bold">{destination.title}</span>
                <span className="mt-2 font-dm text-sm leading-relaxed text-t2">{destination.description}</span>
                <span className="mt-auto inline-flex items-center gap-2 pt-5 font-dm text-sm font-semibold text-acc">
                  Go there
                  <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-b1 pt-8">
          <Link href="/" prefetch={false} className="btn-primary font-dm">
            Back to the homepage <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/contact" prefetch={false} className="btn-ghost font-dm">
            Tell us what you were looking for
          </Link>
        </div>
      </div>
    </div>
  )
}
