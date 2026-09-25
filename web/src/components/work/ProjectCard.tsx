import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { ClientLogo } from "@/components/ClientLogo"
import { cardImage, primaryImage, type CaseStudy } from "@/lib/case-studies"
import { logoForProject } from "@/lib/client-proof"
import { cn } from "@/lib/utils"
import { ProjectScreenshot, hostFromUrl } from "./ProjectScreenshot"

interface ProjectCardProps {
  study: CaseStudy
  /** `feature` spans the grid with a larger image; `compact` suits service-page proof rows. */
  size?: "feature" | "standard" | "compact"
  headingLevel?: "h2" | "h3"
}

export function ProjectCard({ study, size = "standard", headingLevel: Heading = "h3" }: ProjectCardProps) {
  const image = size === "feature" ? primaryImage(study) : cardImage(study)
  const href = `/work/${study.slug}`
  const logo = logoForProject(study.slug)
  const meta = [study.industry, study.location].filter(Boolean).join(" · ")
  const services = study.services.slice(0, size === "compact" ? 3 : 4)

  return (
    <article className={cn("surface-chrome group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-b1 transition-colors duration-300 hover:border-b2 focus-within:border-acc/50", size === "feature" && "lg:grid lg:grid-cols-[1.45fr_.55fr]")}>
      {image ? (
        // Duplicate of the case-study button for pointer users; hidden from assistive tech and tab order.
        <Link href={href} prefetch={false} tabIndex={-1} aria-hidden="true" className="block border-b border-b1 bg-bg/40 p-3 sm:p-4 lg:border-b-0">
          <ProjectScreenshot
            image={image}
            chrome={image.kind === "screenshot" ? "browser" : "none"}
            host={hostFromUrl(study.websiteUrl)}
            sizes={size === "feature" ? "(min-width: 1024px) 860px, 100vw" : size === "compact" ? "(min-width: 768px) 33vw, 100vw" : "(min-width: 768px) 600px, 100vw"}
            className="transition-transform duration-500 ease-out group-hover:-translate-y-0.5 motion-reduce:transform-none"
          />
        </Link>
      ) : null}

      <div className={cn("flex flex-1 flex-col", size === "compact" ? "p-5" : "p-6 md:p-7", size === "feature" && "lg:border-l lg:border-b1")}>
        {logo ? <ClientLogo name={study.name} logo={logo} height={24} monochrome className="mb-4" /> : null}
        <Heading className={cn("font-syne font-extrabold leading-tight tracking-[-.02em]", size === "feature" ? "text-[clamp(24px,2.4vw,32px)]" : size === "compact" ? "text-xl" : "text-2xl")}>{study.name}</Heading>
        {meta ? <p className="mt-2 font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">{meta}</p> : null}
        {study.summary ? <p className={cn("mt-4 font-dm text-sm leading-relaxed text-t2", size === "compact" && "line-clamp-3")}>{study.summary}</p> : null}

        {services.length > 0 ? (
          <div className="mt-5">
            <p className="sr-only">Key services</p>
            <ul className="flex flex-wrap gap-1.5">
              {services.map((service) => (
                <li key={service} className="rounded-md border border-b1 bg-bg/50 px-2.5 py-1 font-dm text-[11px] text-t2">{service}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
          <Link href={href} prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-semibold text-t1 transition-colors hover:text-acc">
            View case study<span className="sr-only">: {study.name}</span> <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          {study.websiteUrl ? (
            <a href={study.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-dm text-sm text-t2 transition-colors hover:text-t1">
              Visit website<span className="sr-only"> (opens {hostFromUrl(study.websiteUrl)} in a new tab)</span> <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}
