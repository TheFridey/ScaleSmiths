import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  commercialPathways,
  INDUSTRY_CURRENCY_DISCLOSURE,
  type CommercialPathwayId,
  type IndustryPage,
} from "@/lib/industries"

const ORDER: CommercialPathwayId[] = ["build", "growth", "systems", "audit"]

export function IndustryPathways({ page, compact = false }: { page: IndustryPage; compact?: boolean }) {
  const emphasis = new Map(page.pathways.map((item) => [item.pathway, item]))
  const ids = ORDER.filter((id) => {
    if (id === "systems") return page.showCustomSystems || emphasis.has("systems")
    if (id === "audit") return true
    return emphasis.has(id) || id === "build" || id === "growth"
  })

  return (
    <section aria-labelledby={`${page.slug}-pathways`} className={compact ? "" : "border-y border-b1 bg-s1/40 px-6 py-16 md:px-12"}>
      <div className={compact ? "" : "mx-auto max-w-[1240px]"}>
        {!compact ? (
          <div className="max-w-[720px]">
            <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Choose your path</span>
            <h2 id={`${page.slug}-pathways`} className="mt-2 font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              Build, grow, or diagnose — neither route requires the other.
            </h2>
            <p className="mt-4 font-dm text-base leading-relaxed text-t2">
              One-off builds and ongoing partnerships are separate. Pick the route that matches the constraint, not a package you do not need.
            </p>
          </div>
        ) : null}

        <div className={`grid gap-4 ${compact ? "md:grid-cols-2" : "mt-10 md:grid-cols-2 xl:grid-cols-4"}`}>
          {ids.map((id) => {
            const pathway = commercialPathways[id]
            const detail = emphasis.get(id)
            const primary = id === "build" || id === "growth"
            return (
              <article
                key={id}
                className={`flex flex-col rounded-2xl border p-5 ${primary ? "border-acc/35 bg-gradient-to-br from-s2 to-acc/[0.07]" : "border-b1 bg-s1"}`}
              >
                <h3 className="font-syne text-lg font-bold tracking-[-0.02em]">{pathway.shortLabel}</h3>
                {pathway.startingPriceLabel ? (
                  <p className="mt-2 font-dm text-sm font-semibold text-acc">{pathway.startingPriceLabel}</p>
                ) : (
                  <p className="mt-2 font-dm text-sm font-semibold text-t3">Scoped after discovery</p>
                )}
                <p className="mt-3 flex-1 font-dm text-sm leading-relaxed text-t2">{detail?.whoFor ?? pathway.summary}</p>
                <p className="mt-3 font-dm text-xs leading-relaxed text-t3">{pathway.priceNote}</p>
                {detail?.whatNext ? <p className="mt-2 font-dm text-xs leading-relaxed text-t3">Next: {detail.whatNext}</p> : null}
                <Link href={pathway.href(page.slug, page.hubSlug)} prefetch={false} className={`${primary ? "btn-primary" : "btn-ghost"} mt-5 inline-flex w-fit font-dm`}>
                  {pathway.shortLabel} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            )
          })}
        </div>
        <p className="mt-6 max-w-[720px] font-dm text-xs leading-relaxed text-t3">{INDUSTRY_CURRENCY_DISCLOSURE}</p>
      </div>
    </section>
  )
}

export function IndustryHeroCtas({ page }: { page: IndustryPage }) {
  const build = commercialPathways.build
  const growth = commercialPathways.growth
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href={build.href(page.slug, page.hubSlug)} prefetch={false} className="btn-primary font-dm">
        {build.shortLabel} <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <Link href={growth.href(page.slug, page.hubSlug)} prefetch={false} className="btn-ghost font-dm">
        {growth.shortLabel}
      </Link>
      {page.showCustomSystems ? (
        <Link href={commercialPathways.systems.href(page.slug, page.hubSlug)} prefetch={false} className="btn-ghost font-dm text-sm">
          {commercialPathways.systems.shortLabel}
        </Link>
      ) : null}
    </div>
  )
}
