import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AnimateIn, StaggerIn } from "./AnimateIn"
import { ProjectCard } from "./work/ProjectCard"
import { publishedCaseStudies, type CaseStudy } from "@/lib/case-studies"

interface PortfolioProps {
  limit?: number
  showHeading?: boolean
  grouped?: boolean
}

/** The first study in a group leads at full width; the rest sit in a two-column grid. */
function CaseStudyGrid({ items, lead = true }: { items: CaseStudy[]; lead?: boolean }) {
  const [first, ...rest] = items
  if (!first) return null
  return (
    <div className="grid gap-5">
      {lead ? <ProjectCard study={first} size="feature" /> : null}
      <StaggerIn className="grid gap-5 md:grid-cols-2" staggerDelay={0.07}>
        {(lead ? rest : items).map((study) => <ProjectCard key={study.slug} study={study} />)}
      </StaggerIn>
    </div>
  )
}

export function Portfolio({ limit, showHeading = true, grouped = false }: PortfolioProps) {
  const all = publishedCaseStudies()
  const shown = limit ? all.slice(0, limit) : all
  const clientWork = shown.filter((study) => study.portfolioGroup === "client-work")
  const platformWork = shown.filter((study) => study.portfolioGroup === "product-platform")

  return (
    <section aria-label="Selected work" className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-[1240px]">
        {showHeading ? (
          <AnimateIn className="mb-12 flex items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Selected work</span>
              <h2 className="mt-2 font-syne text-[clamp(32px,5vw,56px)] font-extrabold tracking-[-0.035em]">Built around the hard part.</h2>
              <p className="mt-4 font-dm text-base leading-relaxed text-t2">Real businesses, the scope delivered, and the case study behind each build.</p>
            </div>
            {limit ? <Link href="/work" prefetch={false} className="hidden items-center gap-2 font-dm text-sm font-medium text-t2 transition-colors hover:text-t1 md:inline-flex">Explore all work <ArrowRight size={15} aria-hidden="true" /></Link> : null}
          </AnimateIn>
        ) : null}

        {grouped ? (
          <div className="grid gap-24">
            <div>
              <AnimateIn className="mb-7 border-b border-b1 pb-5"><p className="font-dm text-xs font-semibold uppercase tracking-[.16em] text-acc">01 · Client work</p><h2 className="mt-2 font-syne text-3xl font-bold">Commercial delivery.</h2></AnimateIn>
              <CaseStudyGrid items={clientWork} />
            </div>
            <div>
              <AnimateIn className="mb-7 border-b border-b1 pb-5"><p className="font-dm text-xs font-semibold uppercase tracking-[.16em] text-acc">02 · Product / platform work</p><h2 className="mt-2 font-syne text-3xl font-bold">Systems built for complexity.</h2></AnimateIn>
              <CaseStudyGrid items={platformWork} />
            </div>
          </div>
        ) : <CaseStudyGrid items={shown} lead={false} />}

        {limit ? <Link href="/work" prefetch={false} className="mt-8 inline-flex items-center gap-2 font-dm text-sm font-medium text-t2 md:hidden">Explore all work <ArrowRight size={15} aria-hidden="true" /></Link> : null}
      </div>
    </section>
  )
}
