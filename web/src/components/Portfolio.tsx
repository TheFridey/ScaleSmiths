import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AnimateIn, StaggerIn } from "./AnimateIn"
import { PaperBand } from "./PaperBand"
import { ProjectCard } from "./work/ProjectCard"
import { publishedCaseStudies, type CaseStudy } from "@/lib/case-studies"

interface PortfolioProps {
  limit?: number
  showHeading?: boolean
  grouped?: boolean
  excludeSlugs?: string[]
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

export function Portfolio({ limit, showHeading = true, grouped = false, excludeSlugs = [] }: PortfolioProps) {
  const excluded = new Set(excludeSlugs)
  const all = publishedCaseStudies().filter((study) => !excluded.has(study.slug))
  const shown = limit ? all.slice(0, limit) : all
  const clientWork = shown.filter((study) => study.portfolioGroup === "client-work")
  const platformWork = shown.filter((study) => study.portfolioGroup === "product-platform")

  return (
    <PaperBand aria-label="Selected work">
      <div className="mx-auto max-w-[1240px]">
        {showHeading ? (
          <AnimateIn className="mb-8 flex items-end justify-between gap-8 md:mb-10">
            <div className="max-w-[40rem]">
              <span className="paper-label">Selected work</span>
              <h2 className="paper-display mt-3">Built around the hard part.</h2>
              <p className="paper-lede mt-5">Real businesses, the scope delivered, and the case study behind each build.</p>
            </div>
            {limit ? (
              <Link
                href="/work"
                prefetch={false}
                className="hidden items-center gap-2 font-dm text-sm font-medium text-paper-muted transition-colors hover:text-paper-ink md:inline-flex"
              >
                Explore all work <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ) : null}
          </AnimateIn>
        ) : null}

        {grouped ? (
          <div className="grid gap-12 md:gap-14">
            <div>
              <AnimateIn className="mb-6 border-b border-paper-border/50 pb-3">
                <p className="paper-label">01 · Client contracts</p>
                <h2 className="paper-display mt-3 max-w-none text-[clamp(1.25rem,2.2vw,1.625rem)]">
                  Commercial delivery for client organisations.
                </h2>
                <p className="mt-3 max-w-[40rem] font-dm text-sm leading-relaxed text-paper-muted">
                  Paid client work with agreed scope. Not founder-owned products and not demo material.
                </p>
              </AnimateIn>
              <CaseStudyGrid items={clientWork} />
            </div>
            <div id="engineering-complex-systems">
              <AnimateIn className="mb-6 border-b border-paper-border/50 pb-3">
                <p className="paper-label">02 · Engineering &amp; Complex Systems</p>
                <h2 className="paper-display mt-3 max-w-none text-[clamp(1.25rem,2.2vw,1.625rem)]">
                  Platforms, SaaS, integrations and production infrastructure.
                </h2>
                <p className="mt-3 max-w-[40rem] font-dm text-sm leading-relaxed text-paper-muted">
                  Founder-owned and collaborative platforms used as engineering proof. Case studies state ownership and limitations honestly.
                </p>
              </AnimateIn>
              <CaseStudyGrid items={platformWork} />
            </div>
          </div>
        ) : (
          <CaseStudyGrid items={shown} lead={false} />
        )}

        {limit ? (
          <Link
            href="/work"
            prefetch={false}
            className="mt-8 inline-flex items-center gap-2 font-dm text-sm font-medium text-paper-muted md:hidden"
          >
            Explore all work <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </PaperBand>
  )
}
