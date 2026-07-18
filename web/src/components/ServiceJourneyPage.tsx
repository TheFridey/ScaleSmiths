import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react"
import { buildServiceJourneySchemas, projectsForJourney, type ServiceJourney } from "@/lib/service-journeys"

export function ServiceJourneyPage({ journey }: { journey: ServiceJourney }) {
  const projects = projectsForJourney(journey)
  const schemas = buildServiceJourneySchemas(journey, process.env.NEXT_PUBLIC_SITE_URL)
  const isLocal = journey.accent === "local"

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />
      <div className={isLocal ? "journey-local" : "journey-systems"}>
        <section className="px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14">
          <div className="mx-auto max-w-[1240px]">
            <nav aria-label="Breadcrumb" className="font-dm text-xs text-t3">
              <ol className="flex flex-wrap items-center gap-2">
                <li><Link href="/" className="hover:text-t1">Home</Link></li>
                <li aria-hidden="true"><ChevronRight size={12} /></li>
                <li><Link href="/services" className="hover:text-t1">Services</Link></li>
                <li aria-hidden="true"><ChevronRight size={12} /></li>
                <li aria-current="page" className="text-t1">{journey.eyebrow}</li>
              </ol>
            </nav>

            <div className="mt-10 grid gap-10 lg:grid-cols-[1.12fr_.88fr] lg:items-end">
              <div>
                <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{journey.eyebrow}</span>
                <h1 className="mt-3 max-w-4xl font-syne text-[clamp(40px,6.5vw,76px)] font-black leading-[1.01] tracking-[-.04em]">{journey.title}</h1>
                <p className="mt-6 max-w-3xl font-dm text-lg leading-relaxed text-t2">{journey.description}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={journey.primaryCta.href} prefetch={false} className="btn-primary font-dm">{journey.primaryCta.label}<ArrowRight size={16} aria-hidden="true" /></Link>
                  <Link href={journey.secondaryCta.href} prefetch={false} className="btn-ghost font-dm">{journey.secondaryCta.label}</Link>
                </div>
              </div>

              <aside aria-label={`Who ${journey.eyebrow} is for`} className={`rounded-2xl border p-6 md:p-8 ${isLocal ? "border-success/25 bg-success/[.07]" : "border-acc/25 bg-acc/[.07]"}`}>
                <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Designed for</p>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {journey.audience.map((audience) => <li key={audience} className="flex items-center gap-3 font-dm text-sm text-t1"><CheckCircle2 size={15} className="shrink-0 text-acc" aria-hidden="true" />{audience}</li>)}
                </ul>
                <p className="mt-6 border-t border-b1 pt-5 font-dm text-sm leading-relaxed text-t2">{journey.buyerQuestion}</p>
              </aside>
            </div>
          </div>
        </section>

        <section aria-labelledby={`${journey.slug}-outcomes`} className="border-y border-b1 bg-s1/60 px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-[1240px]">
            <h2 id={`${journey.slug}-outcomes`} className="max-w-2xl font-syne text-[clamp(30px,4.5vw,48px)] font-extrabold tracking-[-.03em]">{journey.outcomesTitle}</h2>
            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {journey.outcomes.map((outcome, index) => (
                <article key={outcome.title} className="rounded-2xl border border-b1 bg-bg/60 p-6">
                  <div className="font-syne text-sm font-bold text-acc">0{index + 1}</div>
                  <h3 className="mt-3 font-syne text-xl font-bold">{outcome.title}</h3>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{outcome.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby={`${journey.slug}-proof`} className="px-6 py-16 md:px-12 md:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-3xl">
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Relevant proof</span>
              <h2 id={`${journey.slug}-proof`} className="mt-2 font-syne text-[clamp(30px,4.5vw,48px)] font-extrabold">Work mapped to this journey.</h2>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{journey.proofIntro}</p>
            </div>
            <div className={`mt-9 grid gap-3 ${projects.length > 2 ? "md:grid-cols-2" : "md:grid-cols-2"}`}>
              {projects.map((project) => (
                <Link key={project.slug} href={`/work/${project.slug}`} prefetch={false} className="group overflow-hidden rounded-2xl border border-b1 bg-s1 transition-colors hover:border-b2">
                  {project.thumbImage && <div className="relative aspect-[16/8] overflow-hidden border-b border-b1 bg-s2"><Image src={project.thumbImage} alt={`${project.name} project preview`} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.025]" /></div>}
                  <div className="p-6">
                    <div className="font-dm text-xs font-semibold uppercase tracking-[.1em] text-acc">{project.type}</div>
                    <h3 className="mt-2 font-syne text-2xl font-bold">{project.name}</h3>
                    <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{project.headline}</p>
                    <span className="mt-5 inline-flex items-center gap-2 font-dm text-sm font-semibold text-t1">View project<ArrowRight size={14} aria-hidden="true" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby={`${journey.slug}-process`} className="px-6 pb-16 md:px-12 md:pb-24">
          <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">How buying works</span>
              <h2 id={`${journey.slug}-process`} className="mt-2 font-syne text-3xl font-extrabold">{journey.processTitle}</h2>
              <p className="mt-4 font-dm text-sm leading-relaxed text-t2">Pricing is scoped after discovery around the approved outcome, complexity, integrations, content, and delivery risk. Ongoing support is optional and scoped separately.</p>
              <Link href="/pricing" prefetch={false} className="mt-5 inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">Read pricing guidance<ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {journey.process.map((step, index) => <li key={step.title} className="rounded-2xl border border-b1 bg-s1 p-5"><span className="font-syne text-sm font-bold text-acc">{index + 1}</span><h3 className="mt-2 font-syne text-lg font-bold">{step.title}</h3><p className="mt-2 font-dm text-sm leading-relaxed text-t2">{step.description}</p></li>)}
            </ol>
          </div>
        </section>

        <section aria-labelledby={`${journey.slug}-related`} className="border-y border-b1 bg-s1 px-6 py-14 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 id={`${journey.slug}-related`} className="font-syne text-2xl font-bold">Explore the relevant detail</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-3">{journey.relatedPages.map((page) => <Link key={page.href} href={page.href} prefetch={false} className="rounded-xl border border-b1 bg-bg/60 p-5 transition-colors hover:border-b2"><h3 className="font-syne text-lg font-bold">{page.label}</h3><p className="mt-2 font-dm text-sm leading-relaxed text-t2">{page.description}</p></Link>)}</div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={journey.primaryCta.href} prefetch={false} className="btn-primary font-dm">{journey.primaryCta.label}<ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href={journey.slug === "local-growth" ? "/custom-systems" : "/local-growth"} prefetch={false} className="btn-ghost font-dm">View the other service route</Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
