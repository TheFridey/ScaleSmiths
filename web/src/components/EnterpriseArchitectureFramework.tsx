import Link from "next/link"
import { ArrowDown, ArrowRight } from "lucide-react"
import { AnimateIn, StaggerIn } from "@/components/AnimateIn"
import {
  architectureCapabilityGroups,
  architectureDeploymentOptions,
  architectureDiagramLayers,
  architectureFrameworkCopy,
  architectureRelatedLinks,
} from "@/lib/enterprise-architecture"
import { cn } from "@/lib/utils"

interface EnterpriseArchitectureFrameworkProps {
  /** Heading element id prefix so multiple mounts on a page stay unique if ever needed. */
  idPrefix?: string
  className?: string
  /** Hide self-link when already on /enterprise. */
  hideEnterpriseLink?: boolean
}

export function EnterpriseArchitectureFramework({
  idPrefix = "architecture",
  className,
  hideEnterpriseLink = false,
}: EnterpriseArchitectureFrameworkProps) {
  const followsId = `${idPrefix}-follows-problem`
  const diagramId = `${idPrefix}-diagram`
  const capabilitiesId = `${idPrefix}-capabilities`
  const related = hideEnterpriseLink
    ? architectureRelatedLinks.filter((link) => link.href !== "/enterprise")
    : architectureRelatedLinks

  return (
    <section
      aria-labelledby={followsId}
      className={cn("border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24", className)}
      data-testid="enterprise-architecture-framework"
    >
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="max-w-[820px]">
          <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{architectureFrameworkCopy.eyebrow}</p>
          <h2 id={followsId} className="mt-3 font-syne text-[clamp(30px,5vw,52px)] font-extrabold leading-[1.05] tracking-[-.03em]">
            {architectureFrameworkCopy.title}
          </h2>
          <p className="mt-5 max-w-[720px] font-dm text-base leading-relaxed text-t2">{architectureFrameworkCopy.lede}</p>
        </AnimateIn>

        <div className="mt-12">
          <h3 className="font-syne text-xl font-bold tracking-[-.01em]">{architectureFrameworkCopy.deploymentTitle}</h3>
          <p className="mt-3 max-w-[680px] font-dm text-sm leading-relaxed text-t2">{architectureFrameworkCopy.deploymentIntro}</p>
          <StaggerIn className="mt-6 grid gap-3 md:grid-cols-2">
            {architectureDeploymentOptions.map((option) => (
              <article key={option.title} className="rounded-2xl border border-b1 bg-bg/70 p-5 md:p-6">
                <h4 className="font-syne text-base font-bold">{option.title}</h4>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{option.body}</p>
              </article>
            ))}
          </StaggerIn>
          <p className="mt-4 font-dm text-xs leading-relaxed text-t3">
            Subject to project and security requirements. Topology is agreed in discovery — not assumed from a default hosting package.
          </p>
        </div>

        <div className="mt-16" aria-labelledby={diagramId}>
          <AnimateIn className="max-w-[720px]">
            <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Reference shape</p>
            <h3 id={diagramId} className="mt-2 font-syne text-[clamp(24px,3.5vw,36px)] font-extrabold tracking-[-.02em]">
              {architectureFrameworkCopy.diagramTitle}
            </h3>
            <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{architectureFrameworkCopy.diagramIntro}</p>
          </AnimateIn>

          <figure className="architecture-diagram enterprise-panel mt-8 rounded-2xl border border-b1 bg-bg/60 p-4 sm:p-6 md:p-8">
            <figcaption className="sr-only">
              Typical enterprise architecture flow from users through identity, applications, API, services, data stores, integrations, and monitoring.
            </figcaption>
            <ol className="architecture-diagram__flow">
              {architectureDiagramLayers.map((layer, index) => (
                <li key={layer.id} className="architecture-diagram__node">
                  <div className="architecture-diagram__card">
                    <span className="architecture-diagram__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <span className="architecture-diagram__label">{layer.label}</span>
                    <span className="architecture-diagram__detail">{layer.detail}</span>
                  </div>
                  {index < architectureDiagramLayers.length - 1 ? (
                    <span className="architecture-diagram__connector" aria-hidden="true">
                      <ArrowDown size={14} className="architecture-diagram__arrow-down" />
                      <ArrowRight size={14} className="architecture-diagram__arrow-right" />
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </figure>
        </div>

        <div className="mt-16" aria-labelledby={capabilitiesId}>
          <AnimateIn className="max-w-[720px]">
            <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Capability groups</p>
            <h3 id={capabilitiesId} className="mt-2 font-syne text-[clamp(24px,3.5vw,36px)] font-extrabold tracking-[-.02em]">
              Six layers of serious system capability.
            </h3>
            <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
              Each item is included because of the operational job it does — not because it looks impressive on a slide.
            </p>
          </AnimateIn>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {architectureCapabilityGroups.map((group) => (
              <article key={group.id} className="rounded-2xl border border-b1 bg-bg p-6 md:p-7" data-architecture-group={group.id}>
                <h3 className="font-syne text-xl font-bold tracking-[-.01em]">{group.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{group.intro}</p>
                <ul className="mt-5 grid gap-4">
                  {group.capabilities.map((capability) => (
                    <li key={capability.name} className="border-t border-b1/80 pt-4 first:border-t-0 first:pt-0">
                      <p className="font-syne text-sm font-bold text-acc">{capability.name}</p>
                      <p className="mt-1.5 font-dm text-sm leading-relaxed text-t2">{capability.why}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {related.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className="rounded-xl border border-b1 bg-bg/60 p-5 transition-colors hover:border-b2"
            >
              <span className="inline-flex items-center gap-2 font-syne text-lg font-bold">
                {link.label}
                <ArrowRight size={14} aria-hidden="true" className="text-acc" />
              </span>
              <span className="mt-2 block font-dm text-sm leading-relaxed text-t2">{link.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
