import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AnimateIn, StaggerIn } from "@/components/AnimateIn"
import { engagementModels } from "@/lib/engagement-models"

/**
 * Three commercial routes that keep SME starting prices available without
 * making a retail price grid the homepage's lead commercial story.
 */
export function EngagementModels({
  id = "engagement-models",
  compact = false,
}: {
  id?: string
  compact?: boolean
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={compact ? "px-6 py-16 md:px-12 md:py-20" : "border-y border-b1 bg-s1/60 px-6 py-20 md:px-12 md:py-24"}
    >
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="max-w-[760px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">How we engage</span>
          <h2 id={`${id}-heading`} className="mt-3 font-syne text-[clamp(30px,4.6vw,48px)] font-extrabold leading-[1.05] tracking-[-.03em]">
            Three ways to work with ScaleSmiths.
          </h2>
          <p className="mt-4 font-dm text-base leading-relaxed text-t2">
            Website starting prices remain published for the right briefs. Larger digital transformations and custom platforms are scoped independently after discovery, so procurement is never asked to judge complex work against an entry website figure.
          </p>
        </AnimateIn>

        <StaggerIn className="mt-10 grid gap-4 lg:grid-cols-3" staggerDelay={0.08}>
          {engagementModels.map((model) => (
            <article
              key={model.id}
              className="flex h-full flex-col rounded-2xl border border-b1 bg-bg p-6 md:p-7"
            >
              <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">{model.eyebrow}</p>
              <h3 className="mt-3 font-syne text-xl font-bold tracking-[-.02em]">{model.title}</h3>
              <p className="mt-3 flex-1 font-dm text-sm leading-relaxed text-t2">{model.description}</p>
              <div className="mt-6 flex flex-col gap-3">
                <Link href={model.href} prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
                  {model.cta} <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <Link href={model.secondaryHref} prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-medium text-t2 hover:text-t1">
                  {model.secondaryCta} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </StaggerIn>

        <p className="mt-8 max-w-[70ch] font-dm text-sm leading-relaxed text-t3">
          Website design and development from £2,000 and Growth Partnerships from £350/month remain available. Those figures are entry points for agreed SME scopes, not a description of enterprise websites, multi-site journeys or custom platforms.
        </p>
      </div>
    </section>
  )
}
