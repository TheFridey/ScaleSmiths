"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Search, X } from "lucide-react"

export interface FaqLink {
  href: string
  label: string
  description?: string
}

export interface FaqEntryView {
  id: string
  anchor: string
  q: string
  a: string
  services: FaqLink[]
  insights: FaqLink[]
}

export interface FaqCategoryView {
  slug: string
  label: string
  description: string
  faqs: FaqEntryView[]
  services: FaqLink[]
  insights: FaqLink[]
  cta: { href: string; label: string; description: string }
}

function matches(faq: FaqEntryView, category: FaqCategoryView, terms: string[]) {
  if (terms.length === 0) return true
  const haystack = `${faq.q} ${faq.a} ${category.label}`.toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

export function FaqKnowledgeBase({ categories }: { categories: FaqCategoryView[] }) {
  const [query, setQuery] = useState("")
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set())

  const terms = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query])
  const searching = terms.length > 0

  const visible = useMemo(
    () => categories.map((category) => ({ category, faqs: category.faqs.filter((faq) => matches(faq, category, terms)) })).filter((group) => group.faqs.length > 0),
    [categories, terms],
  )
  const resultCount = visible.reduce((total, group) => total + group.faqs.length, 0)

  // Deep links: /faq#faq-what-is-spf opens and reveals that one answer.
  const openFromHash = useCallback(() => {
    const anchor = window.location.hash.replace(/^#/, "")
    if (!anchor) return
    const id = categories.flatMap((category) => category.faqs).find((faq) => faq.anchor === anchor)?.id
    if (!id) return
    setOpenIds((current) => new Set(current).add(id))
    window.requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: "center" }))
  }, [categories])

  useEffect(() => {
    openFromHash()
    window.addEventListener("hashchange", openFromHash)
    return () => window.removeEventListener("hashchange", openFromHash)
  }, [openFromHash])

  const toggle = (id: string, open: boolean) =>
    setOpenIds((current) => {
      const next = new Set(current)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-24 md:px-12">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <label htmlFor="faq-search" className="font-dm text-[11px] font-semibold uppercase tracking-[.14em] text-t3">
            Search the answers
          </label>
          <div className="relative mt-3">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-t3" />
            <input
              id="faq-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="hosting, DMARC, deposit…"
              autoComplete="off"
              className="field-control min-h-11 w-full rounded-lg pl-10 pr-10 text-sm"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-t3 transition-colors hover:text-t1"
                aria-label="Clear search"
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <p aria-live="polite" className="mt-3 font-dm text-xs text-t3">
            {searching ? `${resultCount} ${resultCount === 1 ? "answer" : "answers"} matching “${query.trim()}”` : `${categories.reduce((total, category) => total + category.faqs.length, 0)} answers across ${categories.length} topics`}
          </p>

          <nav aria-label="FAQ categories" className="mt-8 border-t border-b1 pt-6">
            <ul className="grid gap-1">
              {categories.map((category) => {
                const count = visible.find((group) => group.category.slug === category.slug)?.faqs.length ?? 0
                const label = (
                  <>
                    {category.label}
                    <span className="font-dm text-[11px] tabular-nums text-t3">{count}</span>
                  </>
                )
                return (
                  <li key={category.slug}>
                    {/* A filtered-out group is not on the page, so it gets plain text rather than a link to nothing. */}
                    {count === 0 ? (
                      <span className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 font-dm text-sm text-t3/50">{label}</span>
                    ) : (
                      <a href={`#${category.slug}`} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 font-dm text-sm text-t2 transition-colors hover:bg-s1 hover:text-t1">
                        {label}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>

        <div className="grid gap-16">
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-b1 bg-s1 p-8">
              <h2 className="font-syne text-xl font-bold">No answer matches “{query.trim()}”.</h2>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
                The library only covers what ScaleSmiths can answer accurately. If your question is not here, ask the founders directly rather than relying on a guess.
              </p>
              <Link href="/contact" prefetch={false} className="btn-primary mt-6 inline-flex font-dm">
                Ask a question <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          ) : null}

          {visible.map(({ category, faqs }) => (
            <section key={category.slug} id={category.slug} aria-labelledby={`${category.slug}-heading`} className="scroll-mt-24">
              <h2 id={`${category.slug}-heading`} className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-.03em]">
                {category.label}
              </h2>
              <p className="mt-3 max-w-[680px] font-dm text-base leading-relaxed text-t2">{category.description}</p>

              <div className="mt-8 overflow-hidden rounded-2xl border border-b1 bg-s1">
                {faqs.map((faq, index) => (
                  <details
                    key={faq.id}
                    id={faq.anchor}
                    open={openIds.has(faq.id)}
                    onToggle={(event) => toggle(faq.id, event.currentTarget.open)}
                    className={`group scroll-mt-24 ${index < faqs.length - 1 ? "border-b border-b1" : ""}`}
                  >
                    <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 px-6 py-5 font-syne text-base font-bold text-t1 marker:content-none focus-visible:outline-offset-[-3px] md:px-7">
                      {faq.q}
                      <span aria-hidden="true" className="shrink-0 text-xl font-normal leading-none text-acc transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <div className="px-6 pb-6 md:px-7">
                      <p className="max-w-[760px] font-dm text-sm leading-[1.78] text-t2">{faq.a}</p>
                      {faq.services.length > 0 || faq.insights.length > 0 ? (
                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          {faq.services.map((link) => (
                            <Link key={link.href} href={link.href} prefetch={false} className="inline-flex min-h-8 items-center rounded-md border border-b1 bg-bg px-3 py-1.5 font-dm text-xs text-t2 transition-colors hover:border-b2 hover:text-t1">
                              {link.label}
                            </Link>
                          ))}
                          {faq.insights.map((link) => (
                            <Link key={link.href} href={link.href} prefetch={false} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1.5 font-dm text-xs text-t3 underline decoration-b2 underline-offset-4 transition-colors hover:text-t1">
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>

              {!searching ? (
                <div className="mt-6 grid gap-4 md:grid-cols-[1.1fr_.9fr]">
                  <div className="rounded-2xl border border-b1 p-6">
                    <p className="font-dm text-[11px] font-semibold uppercase tracking-[.14em] text-t3">Where this is covered in depth</p>
                    <ul className="mt-4 grid gap-2">
                      {category.services.map((link) => (
                        <li key={link.href}>
                          <Link href={link.href} prefetch={false} className="group/link flex items-baseline gap-2 font-dm text-sm text-t2 transition-colors hover:text-t1">
                            <ArrowRight size={13} aria-hidden="true" className="translate-y-0.5 shrink-0 text-acc transition-transform group-hover/link:translate-x-0.5" />
                            <span>
                              <span className="font-medium text-t1">{link.label}</span>
                              {link.description ? <span className="text-t3"> — {link.description}</span> : null}
                            </span>
                          </Link>
                        </li>
                      ))}
                      {category.insights.map((link) => (
                        <li key={link.href}>
                          <Link href={link.href} prefetch={false} className="group/link flex items-baseline gap-2 font-dm text-sm text-t2 transition-colors hover:text-t1">
                            <ArrowRight size={13} aria-hidden="true" className="translate-y-0.5 shrink-0 text-t3 transition-transform group-hover/link:translate-x-0.5" />
                            <span>{link.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col rounded-2xl border border-acc/20 bg-acc/[.05] p-6">
                    <p className="font-dm text-[11px] font-semibold uppercase tracking-[.14em] text-acc">Next step</p>
                    <p className="mt-3 mb-6 font-dm text-sm leading-relaxed text-t2">{category.cta.description}</p>
                    <Link href={category.cta.href} prefetch={false} className="btn-ghost mt-auto w-fit font-dm">
                      {category.cta.label} <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
