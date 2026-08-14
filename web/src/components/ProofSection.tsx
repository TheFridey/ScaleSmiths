import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { projects } from "@/lib/data"
import type { PublicClaim } from "@/lib/public-claims"
import { AnimateIn, StaggerIn } from "./AnimateIn"

const proofProjects = projects.slice(0, 3)

export function ProofSection({ claims }: { claims: ReadonlyMap<string, PublicClaim> }) {
  return (
    <section aria-label="Project proof" className="px-6 md:px-12 py-24">
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="mb-12 max-w-[720px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Proof</span>
          <h2 className="mt-2 font-syne text-[clamp(30px,5vw,52px)] font-extrabold tracking-[-0.025em]">
            Work that ties craft to commercial movement.
          </h2>
          <p className="mt-4 font-dm text-base leading-relaxed text-t2">
            Pretty pages are only useful when they change the way a business sells, operates, or scales.
            These build records show the implemented interface, workflow and infrastructure decisions. Commercial results appear only when supporting evidence has been reviewed.
          </p>
        </AnimateIn>

        <StaggerIn className="grid gap-4 lg:grid-cols-3" staggerDelay={0.08}>
          {proofProjects.map((project, index) => (
            <article key={project.slug} className="rounded-2xl border border-b1 bg-s1 p-5">
              {project.thumbImage && (
                <Link href={`/work/${project.slug}`} prefetch={false} className="group relative mb-5 block aspect-[16/10] overflow-hidden rounded-xl border border-b1 bg-s2">
                  <Image
                    src={project.thumbImage}
                    alt={`${project.name} project screenshot`}
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    priority={index === 0}
                    placeholder={project.blurDataURL ? "blur" : "empty"}
                    blurDataURL={project.blurDataURL}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                  />
                </Link>
              )}

              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-syne text-xl font-bold">{project.name}</h3>
                  <p className="mt-1 font-dm text-sm text-t2">{project.type}</p>
                </div>
                <span className="rounded-md border border-b1 bg-s2 px-2.5 py-1 font-dm text-[11px] text-t2">
                  {project.location}
                </span>
              </div>

              <div className="grid gap-2">
                <div className="rounded-xl border border-b1 bg-s2 p-4">
                  <div className="font-dm text-[11px] font-semibold uppercase tracking-[.12em] text-t3">Before</div>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{project.challenge}</p>
                </div>
                <div className="rounded-xl border border-acc/20 bg-acc/10 p-4">
                  <div className="font-dm text-[11px] font-semibold uppercase tracking-[.12em] text-acc">After</div>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t1">{project.solution}</p>
                </div>
              </div>

              <ul className="mt-5 flex flex-col gap-2" aria-label={`${project.name} verified outcomes or delivered capabilities`}>
                {(project.outcomeClaimIds.map((id) => claims.get(id)?.approvedWording).filter((value): value is string => Boolean(value)).slice(0, 2).length
                  ? project.outcomeClaimIds.map((id) => claims.get(id)?.approvedWording).filter((value): value is string => Boolean(value)).slice(0, 2)
                  : project.features.slice(0, 2)
                ).map((outcome) => (
                  <li key={outcome} className="flex gap-2.5 font-dm text-sm leading-relaxed text-t2">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-grn" aria-hidden="true" />
                    {outcome}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap gap-1.5" aria-label={`${project.name} stack`}>
                {project.tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="rounded border border-b1 bg-s2 px-2 py-1 font-dm text-[11px] text-t2">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </StaggerIn>

        <AnimateIn className="mt-10">
          <Link href="/work" prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-medium text-t2 transition-colors hover:text-t1">
            See the full proof library <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </AnimateIn>
      </div>
    </section>
  )
}
