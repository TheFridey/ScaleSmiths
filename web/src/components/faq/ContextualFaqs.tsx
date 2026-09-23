import Link from "next/link"
import { ArrowRight } from "lucide-react"

export interface ContextualFaqItem {
  q: string
  a: string
  /** Anchor of the same answer on /faq, when the question comes from the knowledge base. */
  anchor?: string
}

/**
 * The FAQ block used on service, landing and location pages: a short, intent-scoped subset of
 * the knowledge base that always routes back to the full library at /faq rather than leaving the
 * answers stranded on one page.
 *
 * Native <details>/<summary> so the control is keyboard operable, findable by in-page search and
 * usable before hydration.
 */
export function ContextualFaqs({
  id,
  eyebrow = "Buyer FAQs",
  title = "Direct answers before the call.",
  intro,
  items,
  hubHash,
  className = "",
}: {
  id: string
  eyebrow?: string
  title?: string
  intro?: string
  items: readonly ContextualFaqItem[]
  /** Category anchor on /faq, e.g. "seo", so "browse all" lands on the relevant group. */
  hubHash?: string
  className?: string
}) {
  if (items.length === 0) return null
  const hubHref = hubHash ? `/faq#${hubHash}` : "/faq"

  return (
    <section aria-labelledby={`${id}-heading`} className={`px-6 py-20 md:px-12 ${className}`.trim()}>
      <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{eyebrow}</span>
          <h2 id={`${id}-heading`} className="mt-2 font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em]">
            {title}
          </h2>
          {intro ? <p className="mt-4 max-w-[420px] font-dm text-sm leading-relaxed text-t2">{intro}</p> : null}
          <Link href={hubHref} prefetch={false} className="group mt-6 inline-flex items-center gap-2 font-dm text-sm font-medium text-t1">
            Browse the full FAQ knowledge base
            <ArrowRight size={14} aria-hidden="true" className="text-acc transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-b1 bg-s1">
          {items.map((faq, index) => (
            <details key={faq.q} className={`group ${index < items.length - 1 ? "border-b border-b1" : ""}`}>
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 px-6 py-5 font-syne text-base font-bold text-t1 marker:content-none focus-visible:outline-offset-[-3px]">
                {faq.q}
                <span aria-hidden="true" className="shrink-0 text-xl font-normal leading-none text-acc transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="px-6 pb-6">
                <p className="font-dm text-sm leading-[1.78] text-t2">{faq.a}</p>
                {faq.anchor ? (
                  <Link href={`/faq#${faq.anchor}`} prefetch={false} className="mt-4 inline-flex items-center gap-1.5 font-dm text-xs text-t3 underline decoration-b2 underline-offset-4 transition-colors hover:text-t1">
                    Link to this answer
                  </Link>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
