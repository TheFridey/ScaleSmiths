import Link from "next/link"
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import { EnterpriseArchitectureFramework } from "@/components/EnterpriseArchitectureFramework"
import { FounderStrip } from "@/components/FounderStrip"
import { InsightCard } from "@/components/insights/InsightCard"
import { JsonLd } from "@/components/JsonLd"
import { ContextualFaqs } from "@/components/faq/ContextualFaqs"
import { contextualFaqs, faqHubHashFor } from "@/lib/faq-knowledge-base"
import { insightsForService } from "@/lib/insights"
import { buildServiceJourneySchemas, type ServiceJourney } from "@/lib/service-journeys"
import { PaperBand } from "@/components/PaperBand"

export function ServiceJourneyPage({ journey }: { journey: ServiceJourney }) {
  const studies = caseStudiesForSlugs(journey.proofSlugs)
  const articles = insightsForService(`/${journey.slug}`)
  const schemas = buildServiceJourneySchemas(journey, process.env.NEXT_PUBLIC_SITE_URL)
  const isLocal = journey.accent === "local"

  return (
    <>
      <JsonLd data={schemas} />
      <div className={isLocal ? "journey-local" : "journey-systems"}>
        <section className="relative overflow-hidden px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background: isLocal
                ? "radial-gradient(ellipse at 85% 20%, rgba(20,241,178,0.10), transparent 42%)"
                : "radial-gradient(ellipse at 85% 20%, rgba(232,160,69,0.12), transparent 42%)",
            }}
          />
          <div className="relative mx-auto max-w-[1240px]">
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

              <aside aria-label={`Who ${journey.eyebrow} is for`} className={`journey-hero-aside rounded-2xl border p-6 md:p-8 ${isLocal ? "border-success/25 bg-success/[.07]" : "border-acc/25 bg-acc/[.07]"}`}>
                <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Designed for</p>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {journey.audience.map((audience) => <li key={audience} className="flex items-center gap-3 font-dm text-sm text-t1"><CheckCircle2 size={15} className={`shrink-0 ${isLocal ? "text-success" : "text-acc"}`} aria-hidden="true" />{audience}</li>)}
                </ul>
                <p className="mt-6 border-t border-b1 pt-5 font-dm text-sm leading-relaxed text-t2">{journey.buyerQuestion}</p>
              </aside>
            </div>
          </div>
        </section>

        <PaperBand aria-labelledby={`${journey.slug}-outcomes`} compact>
          <div className="mx-auto max-w-[1240px]">
            <h2 id={`${journey.slug}-outcomes`} className="paper-display max-w-2xl">{journey.outcomesTitle}</h2>
            <div className="mt-10 grid gap-0 border-t border-paper-border/50 md:grid-cols-2 md:gap-x-10">
              {journey.outcomes.map((outcome, index) => (
                <article key={outcome.title} className="border-b border-paper-border/50 py-6">
                  <div className="paper-label">0{index + 1}</div>
                  <h3 className="mt-2 font-syne text-lg font-semibold tracking-[-0.01em] text-paper-ink md:text-xl">{outcome.title}</h3>
                  <p className="mt-2 max-w-[36rem] font-dm text-sm leading-[1.65] text-paper-text">{outcome.description}</p>
                </article>
              ))}
            </div>
          </div>
        </PaperBand>

        {!isLocal ? (
          <EnterpriseArchitectureFramework idPrefix={`${journey.slug}-architecture`} />
        ) : null}

        <section aria-labelledby={`${journey.slug}-proof`} className="px-6 py-16 md:px-12 md:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-3xl">
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Relevant proof</span>
              <h2 id={`${journey.slug}-proof`} className="mt-2 font-syne text-[clamp(30px,4.5vw,48px)] font-extrabold">Work mapped to this journey.</h2>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{journey.proofIntro}</p>
            </div>
            <div className="mt-9 grid gap-5 md:grid-cols-2">
              {studies.map((study) => <ProjectCard key={study.slug} study={study} size="compact" />)}
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

        <ContextualFaqs
          id={`${journey.slug}-faqs`}
          eyebrow="Before you enquire"
          title="Questions this route usually raises."
          intro="The same answers appear in the FAQ knowledge base, alongside everything else buyers ask."
          items={contextualFaqs(journey.faqLibrary)}
          hubHash={faqHubHashFor(journey.faqLibrary)}
          className="border-t border-b1 bg-s1/40"
        />

        <FounderStrip
          headingId={`${journey.slug}-founders`}
          intro="ScaleSmiths is founder-led and based in Hucknall, Nottinghamshire. The people who scope the work stay responsible for designing, building and improving it."
        />

        {articles.length > 0 ? (
          <section aria-labelledby={`${journey.slug}-reading`} className="px-6 pb-16 md:px-12">
            <div className="mx-auto max-w-[1240px]">
              <h2 id={`${journey.slug}-reading`} className="font-syne text-3xl font-extrabold">Further reading from the founders</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-3">{articles.map((insight) => <InsightCard key={insight.slug} insight={insight} />)}</div>
            </div>
          </section>
        ) : null}

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
