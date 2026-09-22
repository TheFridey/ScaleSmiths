import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AnimateIn } from "./AnimateIn"
import { ProjectScreenshot, hostFromUrl } from "./work/ProjectScreenshot"
import { getCaseStudy, primaryImage } from "@/lib/case-studies"
import { projects } from "@/lib/data"
import { founderForProject, founderProfileHref } from "@/lib/founders"

/** A platform build complements the client websites already shown in Selected Work. */
export const FEATURED_CASE_STUDY_SLUG = "confirm-a-kill"

export function FeaturedCaseStudy({ slug = FEATURED_CASE_STUDY_SLUG }: { slug?: string }) {
  const project = projects.find((candidate) => candidate.slug === slug)
  if (!project) return null
  const founder = founderForProject(project.slug)
  const study = getCaseStudy(project.slug, { includeDrafts: false })
  const image = study ? primaryImage(study) : undefined

  return (
    <section aria-labelledby="featured-case-study-heading" className="border-y border-b1 bg-s1/40 px-6 py-24 md:px-12">
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="max-w-[760px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Featured case study</span>
          <h2 id="featured-case-study-heading" className="mt-2 font-syne text-[clamp(30px,4.6vw,52px)] font-extrabold tracking-[-.03em]">
            {project.name}
          </h2>
          <p className="mt-4 font-dm text-lg leading-relaxed text-t2">{project.headline}</p>
        </AnimateIn>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
          <AnimateIn>
            {image ? (
              <ProjectScreenshot image={image} chrome={image.kind === "screenshot" ? "browser" : "none"} host={hostFromUrl(project.websiteUrl)} sizes="(min-width: 1024px) 700px, 100vw" />
            ) : null}
          </AnimateIn>

          <AnimateIn delay={0.06} className="flex flex-col">
            <dl className="grid gap-6">
              <div>
                <dt className="font-dm text-[11px] font-semibold uppercase tracking-[.12em] text-t3">The constraint</dt>
                <dd className="mt-2 font-dm text-sm leading-relaxed text-t2">{project.challenge}</dd>
              </div>
              <div>
                <dt className="font-dm text-[11px] font-semibold uppercase tracking-[.12em] text-t3">Production scope</dt>
                <dd className="mt-3">
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {project.features.slice(0, 4).map((feature) => (
                      <li key={feature} className="border-t border-b1 pt-2 font-dm text-sm text-t1">{feature}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="font-dm text-[11px] font-semibold uppercase tracking-[.12em] text-t3">Stack</dt>
                <dd className="mt-2 font-dm text-sm text-t2">{project.tags.join(" · ")}</dd>
              </div>
            </dl>

            <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
              <Link href={`/work/${project.slug}`} prefetch={false} className="btn-primary font-dm">
                Read the case study <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {founder ? (
                <Link href={founderProfileHref(founder)} prefetch={false} className="font-dm text-sm text-t2 transition-colors hover:text-t1">
                  Delivered by {founder.name}
                </Link>
              ) : null}
            </div>
          </AnimateIn>
        </div>
      </div>
    </section>
  )
}
