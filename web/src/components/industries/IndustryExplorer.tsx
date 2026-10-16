"use client"

import { useDeferredValue, useId, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"
import { searchIndustries, type IndustrySearchHit } from "@/lib/industries"
import { missingIndustryHref } from "@/lib/industries/commercial"

function HitCard({ hit }: { hit: IndustrySearchHit }) {
  const isCandidate = hit.kind === "candidate"
  return (
    <li>
      <Link
        href={hit.href}
        prefetch={false}
        className="group flex flex-col gap-2 rounded-xl border border-b1 bg-s1/80 p-4 transition-[border-color,background-color] hover:border-acc/40 hover:bg-s2"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-syne text-base font-bold tracking-[-0.02em] text-t1 group-hover:text-acc">{hit.name}</span>
          <span className="font-dm text-[11px] font-semibold uppercase tracking-[0.14em] text-t3">
            {isCandidate ? "Tell us more" : hit.kind === "hub" ? "Hub" : "Industry page"}
          </span>
        </div>
        <p className="font-dm text-sm leading-relaxed text-t2">{hit.primaryProblem}</p>
        <span className="inline-flex items-center gap-1 font-dm text-xs font-semibold text-acc">
          {isCandidate ? "Request this industry" : "Open"} <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </li>
  )
}

export function IndustryExplorer({ featuredHints = [] }: { featuredHints?: string[] }) {
  const [query, setQuery] = useState("")
  const deferred = useDeferredValue(query)
  const inputId = useId()
  const resultsId = useId()
  const results = useMemo(() => searchIndustries(deferred, 10), [deferred])
  const showEmpty = deferred.trim().length >= 2 && results.length === 0

  return (
    <div className="rounded-2xl border border-b1 bg-s1/60 p-5 md:p-6">
      <label htmlFor={inputId} className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">
        Find your industry
      </label>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-t3" aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. pest control, podiatry, CNC, restaurant…"
          autoComplete="off"
          aria-controls={resultsId}
          aria-describedby={resultsId}
          className="field-control pl-10"
        />
      </div>
      {featuredHints.length > 0 && !query.trim() ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Popular searches">
          {featuredHints.map((hint) => (
            <li key={hint}>
              <button
                type="button"
                onClick={() => setQuery(hint)}
                className="rounded-lg border border-b2 bg-s2 px-3 py-1.5 font-dm text-xs text-t2 transition-colors hover:border-acc/40 hover:text-t1"
              >
                {hint}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div id={resultsId} className="mt-5" aria-live="polite">
        {deferred.trim().length >= 2 ? (
          results.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">{results.map((hit) => <HitCard key={hit.id} hit={hit} />)}</ul>
          ) : showEmpty ? (
            <div className="rounded-xl border border-dashed border-b2 bg-s2/40 p-5">
              <p className="font-syne text-lg font-bold tracking-[-0.02em]">We do not have that page yet — and that is fine.</p>
              <p className="mt-2 font-dm text-sm leading-relaxed text-t2">
                Tell us what you run and what is holding growth back. No unsupported claim that we already specialise in every sector.
              </p>
              <Link href={missingIndustryHref(deferred)} prefetch={false} className="btn-primary mt-4 inline-flex font-dm">
                Tell us your industry <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : null
        ) : (
          <p className="font-dm text-sm text-t3">Type at least two characters. Published pages link directly; candidates open a request route.</p>
        )}
      </div>
    </div>
  )
}
