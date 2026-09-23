import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { buildLandingPageSchemas, getLandingPageFaqs, landingPageFaqHubHash, landingPages, type LandingPage as LandingPageData } from "@/lib/landing-pages"
import { ContextualFaqs } from "@/components/faq/ContextualFaqs"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import { buildLogs } from "@/lib/build-logs"
import { FounderStrip } from "@/components/FounderStrip"
import { InsightCard } from "@/components/insights/InsightCard"
import { JsonLd } from "@/components/JsonLd"
import { insightsForService } from "@/lib/insights"
import { siteBaseUrl } from "@/lib/site-identity"
import { Breadcrumbs } from "@/components/Breadcrumbs"

export function LandingPage({ page }: { page: LandingPageData }) {
  const proofStudies = caseStudiesForSlugs(page.proofLinks)
  const proofLogs = buildLogs.filter((log) => page.buildLogLinks.includes(log.slug))
  const relatedPages = page.relatedPages.map((slug) => landingPages[slug]).filter(Boolean)
  const schemas = buildLandingPageSchemas(page, siteBaseUrl())
  const articles = insightsForService(`/${page.slug}`)
  const faqs = getLandingPageFaqs(page)

  return (
    <>
      <JsonLd data={schemas} />
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-[1240px]">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Services", href: "/services" }, { name: page.title }]} />
          <div className="mt-10 max-w-[820px]">
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{page.eyebrow}</span>
            <h1 className="mt-3 font-syne text-[clamp(42px,8vw,86px)] font-extrabold leading-none tracking-[-0.035em]">
              {page.h1}
            </h1>
            <p className="mt-6 max-w-[700px] font-dm text-lg leading-relaxed text-t2">{page.intro}</p>
            <p className="mt-4 max-w-[720px] border-l border-acc pl-4 font-dm text-sm leading-relaxed text-t3">{page.searchIntent}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/quote" prefetch={false} className="btn-primary font-dm">
                Discuss this service <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/work" prefetch={false} className="btn-ghost font-dm">
                View proof
              </Link>
              <Link href="/services" prefetch={false} className="btn-ghost font-dm">
                View services
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 md:px-12">
        <div className="mx-auto grid max-w-[1240px] gap-4 md:grid-cols-4">
          {page.outcomes.map((outcome) => (
            <div key={outcome} className="rounded-xl border border-b1 bg-s1 p-5">
              <CheckCircle2 size={16} className="mb-4 text-grn" aria-hidden="true" />
              <div className="font-dm text-sm leading-relaxed text-t2">{outcome}</div>
            </div>
          ))}
        </div>
      </section>

      {page.localContext ? (
        <section aria-labelledby={`${page.slug}-local`} className="border-y border-b1 bg-s1/50 px-6 py-16 md:px-12">
          <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{page.location}</span>
              <h2 id={`${page.slug}-local`} className="mt-2 font-syne text-[clamp(26px,3.6vw,38px)] font-extrabold tracking-[-.025em]">{page.localContext.heading}</h2>
            </div>
            <div className="grid gap-4">
              {page.localContext.paragraphs.map((paragraph) => <p key={paragraph} className="font-dm text-base leading-relaxed text-t2">{paragraph}</p>)}
              <p className="font-dm text-sm text-t3">
                <Link href="/about" prefetch={false} className="text-t1 underline-offset-4 hover:underline">About ScaleSmiths</Link>
                {" · "}
                <Link href="/contact" prefetch={false} className="text-t1 underline-offset-4 hover:underline">Contact the founders</Link>
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Fit signals</span>
            <h2 className="mt-2 max-w-[620px] font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em]">
              Signs this is the right service.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {page.problems.map((problem) => (
              <div key={problem} className="rounded-2xl border border-b1 bg-s1 p-5">
                <CheckCircle2 size={16} className="mb-4 text-acc" aria-hidden="true" />
                <p className="font-dm text-sm leading-relaxed text-t2">{problem}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {page.included?.length ? (
        <section aria-labelledby={`${page.slug}-included`} className="border-y border-b1 bg-s1/40 px-6 py-20 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">What is included</span>
            <h2 id={`${page.slug}-included`} className="mt-2 max-w-[760px] font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-.025em]">A scope built around the actual job.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {page.included.map((item) => <article key={item.title} className="rounded-2xl border border-b1 bg-s1 p-6"><h3 className="font-syne text-xl font-bold">{item.title}</h3><p className="mt-3 font-dm text-sm leading-[1.75] text-t2">{item.description}</p></article>)}
            </div>
          </div>
        </section>
      ) : null}

      {page.process?.length ? (
        <section aria-labelledby={`${page.slug}-process`} className="px-6 py-20 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Process</span>
            <h2 id={`${page.slug}-process`} className="mt-2 font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-.025em]">From evidence to a dependable release.</h2>
            <ol className="mt-8 grid gap-4 lg:grid-cols-4">
              {page.process.map((item, index) => <li key={item.title} className="rounded-2xl border border-b1 bg-s1 p-6"><span className="font-dm text-xs font-semibold text-acc">0{index + 1}</span><h3 className="mt-4 font-syne text-lg font-bold">{item.title}</h3><p className="mt-3 font-dm text-sm leading-[1.75] text-t2">{item.description}</p></li>)}
            </ol>
          </div>
        </section>
      ) : null}

      {page.considerations?.length ? (
        <section aria-label="Commercial and technical considerations" className="px-6 py-20 md:px-12">
          <div className="mx-auto grid max-w-[1240px] gap-5 lg:grid-cols-2">
            {page.considerations.map((item) => <article key={item.title} className="rounded-3xl border border-b1 bg-s1 p-7 md:p-9"><h2 className="font-syne text-2xl font-bold">{item.title}</h2><div className="mt-5 space-y-4">{item.paragraphs.map((paragraph) => <p key={paragraph} className="font-dm text-sm leading-[1.8] text-t2">{paragraph}</p>)}</div></article>)}
          </div>
        </section>
      ) : null}

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Relevant proof</span>
              <h2 className="mt-2 font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em]">
                Related ScaleSmiths work.
              </h2>
            </div>
            <Link href="/work" prefetch={false} className="font-dm text-sm font-medium text-t2 transition-colors hover:text-t1">
              All case studies
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {proofStudies.map((study) => <ProjectCard key={study.slug} study={study} size="compact" />)}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-2">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Practical examples</span>
            <h2 className="mt-2 font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em]">
              What this can look like in the real build.
            </h2>
            <div className="mt-8 space-y-3">
              {page.examples.map((example) => (
                <div key={example} className="rounded-2xl border border-b1 bg-s1 p-5">
                  <p className="font-dm text-sm leading-relaxed text-t2">{example}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Build-log proof</span>
            <h2 className="mt-2 font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em]">
              Delivery notes from our own system.
            </h2>
            <div className="mt-8 space-y-3">
              {proofLogs.map((log) => (
                <article key={log.slug} className="rounded-2xl border border-b1 bg-s1 p-5">
                  <h3 className="font-syne text-lg font-bold">
                    <Link href={`/work/${log.slug}`} prefetch={false} className="hover:text-acc">{log.title}</Link>
                  </h3>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{log.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1240px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Comparison</span>
          <h2 className="mt-2 max-w-[760px] font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em]">
            The route matters as much as the result.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              ["Custom build", "Built around your offer, operations, conversion path, and technical ownership.", "Template builder", "Fast to start, but often restrictive once SEO, integrations, or workflow matter."],
              ["Local specialist", "Direct founder-led attention with context for Nottinghamshire and UK service buyers.", "Generic agency", "More layers, less direct access, and a higher chance of generic execution."],
              ["SEO-ready build", "Technical structure, metadata, internal links, schema, and buyer FAQs from the start.", "Design-only site", "Can look sharp while leaving search intent and conversion logic underdeveloped."],
            ].map(([goodTitle, goodCopy, weakTitle, weakCopy]) => (
              <article key={goodTitle} className="rounded-2xl border border-b1 bg-s1 p-6">
                <h3 className="font-syne text-lg font-bold text-t1">{goodTitle}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{goodCopy}</p>
                <div className="my-5 h-px bg-b1" />
                <h4 className="font-syne text-sm font-bold text-t2">{weakTitle}</h4>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t3">{weakCopy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FounderStrip
        headingId={`${page.slug}-founders`}
        intro={page.localContext
          ? "ScaleSmiths is run by its two founders from Hucknall, Nottinghamshire. The people who scope your project are the people who design, build and support it."
          : "ScaleSmiths is founder-led and works with businesses across the UK from Hucknall, Nottinghamshire. There is no hand-off from sales to an outsourced team."}
      />

      {articles.length > 0 ? (
        <section aria-labelledby={`${page.slug}-reading`} className="px-6 pb-20 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 id={`${page.slug}-reading`} className="font-syne text-[clamp(26px,3.6vw,38px)] font-extrabold tracking-[-.025em]">Further reading from the founders</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {articles.map((insight) => <InsightCard key={insight.slug} insight={insight} />)}
            </div>
          </div>
        </section>
      ) : null}
      <ContextualFaqs
        id={`${page.slug}-faqs`}
        intro="The questions buyers actually ask about this work, answered the same way here as everywhere else on the site."
        items={faqs}
        hubHash={landingPageFaqHubHash(page)}
      />

      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-6 font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Related pages</div>
          <div className="flex flex-wrap gap-3">
            <Link href="/" prefetch={false} className="rounded-lg border border-b1 bg-s1 px-4 py-2.5 font-dm text-sm text-t2 transition-colors hover:text-t1">
              Homepage
            </Link>
            <Link href="/services" prefetch={false} className="rounded-lg border border-b1 bg-s1 px-4 py-2.5 font-dm text-sm text-t2 transition-colors hover:text-t1">
              Services
            </Link>
            <Link href="/pricing" prefetch={false} className="rounded-lg border border-b1 bg-s1 px-4 py-2.5 font-dm text-sm text-t2 transition-colors hover:text-t1">
              Pricing
            </Link>
            <Link href="/work" prefetch={false} className="rounded-lg border border-b1 bg-s1 px-4 py-2.5 font-dm text-sm text-t2 transition-colors hover:text-t1">
              Work
            </Link>
            <Link href="/faq" prefetch={false} className="rounded-lg border border-b1 bg-s1 px-4 py-2.5 font-dm text-sm text-t2 transition-colors hover:text-t1">
              Frequently asked questions
            </Link>
            <Link href="/quote" prefetch={false} className="rounded-lg border border-b1 bg-s1 px-4 py-2.5 font-dm text-sm text-t2 transition-colors hover:text-t1">
              Request a quote
            </Link>
            {relatedPages.map((related) => (
              <Link key={related.slug} href={`/${related.slug}`} prefetch={false} className="rounded-lg border border-b1 bg-s1 px-4 py-2.5 font-dm text-sm text-t2 transition-colors hover:text-t1">
                {related.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[900px] text-center">
          <h2 className="font-syne text-[clamp(30px,5vw,52px)] font-extrabold tracking-[-0.025em]">
            Build the version that fits the business.
          </h2>
          <p className="mx-auto mt-4 max-w-[560px] font-dm text-base leading-relaxed text-t2">
            Tell us where you are, what needs to change, and what the site or app has to prove commercially.
          </p>
          <Link href="/quote" prefetch={false} className="btn-primary mt-8 inline-flex font-dm">
            Start with a brief <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  )
}

export function getLandingPage(slug: keyof typeof landingPages) {
  return landingPages[slug]
}
