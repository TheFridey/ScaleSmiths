import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { AnimateIn, StaggerIn } from "./AnimateIn"
import { projects, type Project } from "@/lib/data"

interface PortfolioProps {
  limit?: number
  showHeading?: boolean
  grouped?: boolean
}

function ProjectSurface({ project, index }: { project: Project; index: number }) {
  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-b1 bg-s1 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-1 hover:border-b2 focus-within:border-acc/50">
      <Link href={`/work/${project.slug}`} prefetch={false} className="grid lg:grid-cols-[1.2fr_0.8fr]" aria-label={`Read the ${project.name} case study`}>
        <div className="relative min-h-[280px] overflow-hidden border-b border-b1 bg-s2 lg:min-h-[440px] lg:border-b-0 lg:border-r">
          {project.thumbImage ? (
            <Image
              src={project.thumbImage}
              alt={`${project.name} project preview`}
              fill
              sizes="(min-width: 1024px) 62vw, 100vw"
              placeholder={project.blurDataURL ? "blur" : "empty"}
              blurDataURL={project.blurDataURL}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025] group-focus-within:scale-[1.025] motion-reduce:transform-none"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden="true" />
          <span className="absolute bottom-5 left-5 font-dm text-xs font-semibold uppercase tracking-[.14em] text-white/75">
            0{index + 1} · {project.year}
          </span>
        </div>

        <div className="flex min-h-full flex-col p-6 md:p-9 lg:p-10">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{project.type}</p>
              <h3 className="mt-3 font-syne text-[clamp(28px,4vw,46px)] font-extrabold leading-none tracking-[-0.03em]">{project.name}</h3>
            </div>
            <ArrowUpRight className="shrink-0 text-t3 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-acc group-focus-within:translate-x-1 group-focus-within:-translate-y-1" size={21} aria-hidden="true" />
          </div>

          <dl className="mt-9 grid gap-6">
            <div>
              <dt className="font-dm text-[11px] font-semibold uppercase tracking-[.12em] text-t3">Challenge</dt>
              <dd className="mt-2 line-clamp-3 font-dm text-sm leading-relaxed text-t2">{project.challenge}</dd>
            </div>
            <div>
              <dt className="font-dm text-[11px] font-semibold uppercase tracking-[.12em] text-t3">What ScaleSmiths built</dt>
              <dd className="mt-2 line-clamp-3 font-dm text-sm leading-relaxed text-t1">{project.solution}</dd>
            </div>
            <div>
              <dt className="font-dm text-[11px] font-semibold uppercase tracking-[.12em] text-t3">Delivered</dt>
              <dd className="mt-2 font-dm text-sm leading-relaxed text-t2">{project.features.slice(0, 2).join(" · ")}</dd>
            </div>
          </dl>

          <div className="mt-auto flex items-end justify-between gap-5 pt-9">
            <span className="font-dm text-xs text-t3">ScaleSmiths · {project.location}</span>
            <span className="inline-flex items-center gap-2 font-dm text-sm font-medium text-t1">View case study <ArrowRight size={14} className="transition-transform group-hover:translate-x-1 group-focus-within:translate-x-1" aria-hidden="true" /></span>
          </div>
        </div>
      </Link>
    </article>
  )
}

function ProjectCollection({ items, startIndex = 0 }: { items: Project[]; startIndex?: number }) {
  return (
    <StaggerIn className="grid gap-5" staggerDelay={0.07}>
      {items.map((project, index) => <ProjectSurface key={project.slug} project={project} index={startIndex + index} />)}
    </StaggerIn>
  )
}

export function Portfolio({ limit, showHeading = true, grouped = false }: PortfolioProps) {
  const shown = limit ? projects.slice(0, limit) : projects
  const clientWork = shown.filter((project) => project.portfolioGroup === "client-work")
  const platformWork = shown.filter((project) => project.portfolioGroup === "product-platform")

  return (
    <section aria-label="Selected work" className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-[1240px]">
        {showHeading ? (
          <AnimateIn className="mb-12 flex items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Selected work</span>
              <h2 className="mt-2 font-syne text-[clamp(32px,5vw,56px)] font-extrabold tracking-[-0.035em]">Built around the hard part.</h2>
              <p className="mt-4 font-dm text-base leading-relaxed text-t2">The interface is the visible layer. The proof is in the decisions, systems and production detail underneath it.</p>
            </div>
            {limit ? <Link href="/work" prefetch={false} className="hidden items-center gap-2 font-dm text-sm font-medium text-t2 transition-colors hover:text-t1 md:inline-flex">Explore all work <ArrowRight size={15} aria-hidden="true" /></Link> : null}
          </AnimateIn>
        ) : null}

        {grouped ? (
          <div className="grid gap-24">
            <div>
              <AnimateIn className="mb-7 border-b border-b1 pb-5"><p className="font-dm text-xs font-semibold uppercase tracking-[.16em] text-acc">01 · Client work</p><h2 className="mt-2 font-syne text-3xl font-bold">Commercial delivery.</h2></AnimateIn>
              <ProjectCollection items={clientWork} />
            </div>
            <div>
              <AnimateIn className="mb-7 border-b border-b1 pb-5"><p className="font-dm text-xs font-semibold uppercase tracking-[.16em] text-acc">02 · Product / platform work</p><h2 className="mt-2 font-syne text-3xl font-bold">Systems built for complexity.</h2></AnimateIn>
              <ProjectCollection items={platformWork} startIndex={clientWork.length} />
            </div>
          </div>
        ) : <ProjectCollection items={shown} />}

        {limit ? <Link href="/work" prefetch={false} className="mt-8 inline-flex items-center gap-2 font-dm text-sm font-medium text-t2 md:hidden">Explore all work <ArrowRight size={15} aria-hidden="true" /></Link> : null}
      </div>
    </section>
  )
}
