import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ChevronRight, ExternalLink, MapPin } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { CTA } from "@/components/CTA"
import { FounderPortrait } from "@/components/FounderPortrait"
import { JsonLd } from "@/components/JsonLd"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import { InsightCard } from "@/components/insights/InsightCard"
import { insightsByAuthor } from "@/lib/insights"
import {
  founderBySlug,
  founderFocusAreas,
  founderLinks,
  founderProfileHref,
  founderProfileMetadata,
  founderProjects,
  founders,
} from "@/lib/founders"
import { BUSINESS_LOCATION, siteBaseUrl } from "@/lib/site-identity"
import { buildFounderProfileSchemas } from "@/lib/structured-data"

interface Props {
  params: Promise<{ founder: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return founders.map((founder) => ({ founder: founder.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const founder = founderBySlug((await params).founder)
  return founder ? founderProfileMetadata(founder) : {}
}

const eyebrow = "font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc"

export default async function FounderProfilePage({ params }: Props) {
  const founder = founderBySlug((await params).founder)
  if (!founder) notFound()

  const projects = founderProjects(founder)
  const links = founderLinks(founder)
  const otherFounders = founders.filter((candidate) => candidate.slug !== founder.slug)
  const biography = [...founder.responsibilities, ...founder.involvement]
  const articles = insightsByAuthor(founder.slug)

  return (
    <>
      <JsonLd data={buildFounderProfileSchemas(founder, siteBaseUrl())} />

      <section className="px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14">
        <div className="mx-auto max-w-[1240px]">
          <nav aria-label="Breadcrumb" className="font-dm text-xs text-t3">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link href="/" className="hover:text-t1">Home</Link></li>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li><Link href="/about" className="hover:text-t1">About</Link></li>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li aria-current="page" className="text-t1">{founder.name}</li>
            </ol>
          </nav>

          <div className="mt-10 grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:gap-16">
            <AnimateIn className="mx-auto w-full max-w-[460px] lg:mx-0">
              <FounderPortrait
                image={founder.photo}
                monogram={founder.monogram}
                accent={founder.accent}
                sizes="(min-width: 1024px) 460px, (min-width: 640px) 460px, 100vw"
                priority
              />
            </AnimateIn>

            <AnimateIn delay={0.06}>
              <span className={eyebrow}>{founder.authorTitle}, ScaleSmiths</span>
              <h1 className="mt-3 font-syne text-[clamp(40px,7vw,84px)] font-black leading-[1] tracking-[-.045em]">{founder.name}</h1>
              <p className="mt-4 font-dm text-lg font-semibold text-t1">{founder.role.text}</p>
              <p className="mt-2 flex items-center gap-2 font-dm text-sm text-t3">
                <MapPin size={14} className="text-acc" aria-hidden="true" /> {BUSINESS_LOCATION.locality}, {BUSINESS_LOCATION.region}
              </p>
              <p className="mt-6 max-w-[640px] font-dm text-lg leading-relaxed text-t2">{founder.summary.text}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/quote?intent=strategy_call" prefetch={false} className="btn-primary font-dm">
                  Talk to {founder.firstName} <ArrowRight size={16} aria-hidden="true" />
                </Link>
                {projects.length > 0 ? (
                  <a href="#selected-projects" className="btn-ghost font-dm">Selected projects</a>
                ) : null}
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      <section aria-labelledby="founder-biography" className="border-y border-b1 bg-s1/60 px-6 py-16 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className={eyebrow}>Biography</span>
            <h2 id="founder-biography" className="mt-2 font-syne text-[clamp(28px,4.2vw,44px)] font-extrabold tracking-[-.03em]">
              What {founder.firstName} does at ScaleSmiths.
            </h2>
          </div>
          <div className="grid gap-5">
            {biography.map((statement) => (
              <p key={statement.text} className="font-dm text-base leading-relaxed text-t2">{statement.text}</p>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="founder-expertise" className="px-6 py-16 md:px-12 md:py-20">
        <div className="mx-auto max-w-[1240px]">
          <span className={eyebrow}>Areas of expertise</span>
          <h2 id="founder-expertise" className="mt-2 font-syne text-[clamp(26px,3.6vw,38px)] font-extrabold tracking-[-.03em]">Where {founder.firstName} leads.</h2>
          <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {founderFocusAreas(founder).map((area) => (
              <li key={area} className="rounded-xl border border-b1 bg-s1 px-4 py-4 font-syne text-base font-bold">
                <span className="mb-3 block h-1 w-8 rounded-full" style={{ background: founder.accent }} aria-hidden="true" />
                {area}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {projects.length > 0 ? (
        <section id="selected-projects" aria-labelledby="founder-projects" className="scroll-mt-24 border-y border-b1 bg-s1/40 px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-[1240px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className={eyebrow}>Selected projects</span>
                <h2 id="founder-projects" className="mt-2 font-syne text-[clamp(26px,3.6vw,38px)] font-extrabold tracking-[-.03em]">Work credited to {founder.firstName}.</h2>
              </div>
              <Link href="/work" prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-medium text-t2 hover:text-t1">
                All ScaleSmiths work <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {caseStudiesForSlugs(founder.projectSlugs).map((study) => <ProjectCard key={study.slug} study={study} size="compact" />)}
            </div>
          </div>
        </section>
      ) : null}

      {articles.length > 0 ? (
        <section aria-labelledby="founder-insights" className="px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-[1240px]">
            <span className={eyebrow}>Insights</span>
            <h2 id="founder-insights" className="mt-2 font-syne text-[clamp(26px,3.6vw,38px)] font-extrabold tracking-[-.03em]">Written by {founder.firstName}.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((insight) => <InsightCard key={insight.slug} insight={insight} />)}
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="founder-next" className="px-6 py-16 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-b1 bg-s1 p-6">
            <h2 id="founder-next" className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Related services</h2>
            <ul className="mt-4 grid gap-2">
              {founder.relatedServices.map((service) => (
                <li key={service.href}>
                  <Link href={service.href} prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-medium text-t1 hover:text-acc">
                    {service.label} <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-b1 bg-s1 p-6">
            <h2 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Also leading ScaleSmiths</h2>
            <ul className="mt-4 grid gap-3">
              {otherFounders.map((other) => (
                <li key={other.slug}>
                  <Link href={founderProfileHref(other)} prefetch={false} className="group block">
                    <span className="block font-syne text-lg font-bold group-hover:text-acc">{other.name}</span>
                    <span className="mt-1 block font-dm text-sm text-t2">{other.role.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-b1 bg-s1 p-6">
            <h2 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Profiles & contact</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    {...(link.href.startsWith("https:") ? { target: "_blank", rel: "noopener noreferrer me" } : {})}
                    className="inline-flex items-center gap-2 rounded-lg border border-b2 px-4 py-2 font-dm text-sm font-medium text-t2 transition-colors hover:text-t1"
                  >
                    {link.label} <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </li>
              ))}
              <li>
                <Link href="/contact" prefetch={false} className="inline-flex items-center gap-2 rounded-lg border border-b2 px-4 py-2 font-dm text-sm font-medium text-t2 transition-colors hover:text-t1">
                  Contact ScaleSmiths
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <CTA />
    </>
  )
}
