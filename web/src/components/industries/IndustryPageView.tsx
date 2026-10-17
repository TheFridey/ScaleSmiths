import Link from "next/link"
import { ArrowRight, CircleHelp } from "lucide-react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { FounderStrip } from "@/components/FounderStrip"
import { JsonLd } from "@/components/JsonLd"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import {
  buildIndustryPageSchemas,
  getIndustryDemonstration,
  getIndustryHub,
  industryDemonstrationPath,
  industryPath,
  publishedIndustryPages,
  type IndustryPage,
} from "@/lib/industries"
import { siteBaseUrl } from "@/lib/site-identity"
import { routeLabel } from "@/lib/service-routes"
import { IndustryHeroCtas, IndustryPathways } from "./IndustryPathways"

function relatedIndustryHref(slug: string, fallbackHub: string) {
  const match = publishedIndustryPages().find((page) => page.slug === slug)
  return match ? industryPath(match.hubSlug, match.slug) : industryPath(fallbackHub, slug)
}

const PROOF_BADGE: Record<IndustryPage["proof"]["level"], string> = {
  direct: "Completed work in this industry",
  adjacent: "Completed work in a related field",
  illustrative: "Illustrative example — not a claimed delivery",
}

const PROOF_LEGEND: Record<IndustryPage["proof"]["level"], string> = {
  direct: "This is completed ScaleSmiths work for this kind of business. Measured changes and client comments appear only where they are recorded. Anything still being monitored is labelled as such.",
  adjacent: "This is completed work in a related field. It is not a claim that the same result was delivered for this industry.",
  illustrative: "This describes a pattern we would use. It is not a client result and not a delivery we are claiming.",
}

function variantAtmosphere(presentation: IndustryPage["presentation"]) {
  switch (presentation) {
    case "trades":
      return "from-acc/[0.14] via-transparent to-transparent"
    case "clinic":
      return "from-emerald-500/[0.10] via-transparent to-transparent"
    case "hospitality":
      return "from-rose-400/[0.10] via-transparent to-transparent"
    case "ecommerce":
      return "from-sky-400/[0.10] via-transparent to-transparent"
    case "industrial":
      return "from-zinc-300/[0.12] via-transparent to-transparent"
    case "saas":
      return "from-cyan-400/[0.10] via-transparent to-transparent"
    default:
      return "from-acc/[0.10] via-transparent to-transparent"
  }
}

export function IndustryPageView({ page }: { page: IndustryPage }) {
  const hub = getIndustryHub(page.hubSlug)
  const schemas = buildIndustryPageSchemas(page, siteBaseUrl())
  const demonstration = getIndustryDemonstration(page.hubSlug)
  const proofStudies = page.proof.workSlug ? caseStudiesForSlugs([page.proof.workSlug]) : []
  const related = page.relatedIndustrySlugs
    .map((slug) => {
      const match = publishedIndustryPages().find((entry) => entry.slug === slug)
      return match
        ? { slug: match.slug, name: match.name, href: industryPath(match.hubSlug, match.slug) }
        : { slug, name: slug.replaceAll("-", " "), href: relatedIndustryHref(slug, page.hubSlug) }
    })
    .filter((item) => item.slug !== page.slug)

  return (
    <>
      <JsonLd data={schemas} />
      <article>
        <section className={`relative overflow-hidden px-6 py-20 md:px-12 md:py-28 bg-gradient-to-b ${variantAtmosphere(page.presentation)}`}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
            }}
          />
          <div className="relative mx-auto max-w-[1240px]">
            <Breadcrumbs
              items={[
                { name: "Home", href: "/" },
                { name: "Industries", href: "/industries" },
                ...(hub ? [{ name: hub.shortName, href: industryPath(hub.slug) }] : []),
                { name: page.name },
              ]}
            />
            <div className="mt-10 max-w-[820px]">
              <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">{page.eyebrow}</span>
              <h1 className="page-hero-display mt-3">{page.h1}</h1>
              <p className="mt-6 max-w-[700px] font-dm text-lg leading-relaxed text-t2">{page.intro}</p>
              <p className="mt-4 max-w-[720px] font-dm text-base leading-relaxed text-t2">{page.searchIntent}</p>
              <p className="mt-4 font-dm text-sm text-t2">For {page.buyer}</p>
              <IndustryHeroCtas page={page} />
              {demonstration ? (
                <p className="mt-4">
                  <Link href={industryDemonstrationPath(page.hubSlug)} prefetch={false} className="inline-flex min-h-11 items-center font-dm text-sm font-semibold text-acc">
                    Walk through the {demonstration.shortName} workflow
                  </Link>
                </p>
              ) : null}
              <p className="mt-4 max-w-[680px] font-dm text-xs leading-relaxed text-t3">
                <Link href="/pricing#published-prices" prefetch={false} className="underline underline-offset-2 hover:text-t1">Starting prices</Link> are published for websites, partnerships, the audit and business email. Larger work is quoted once the scope is clear.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby={`${page.slug}-frictions`} className="px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 id={`${page.slug}-frictions`} className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              Where customers slip away
            </h2>
            <p className="mt-3 max-w-[640px] font-dm text-base text-t2">
              Where we would start: {page.primaryProblem}
            </p>
            <ul className="mt-10 grid gap-4 md:grid-cols-2">
              {page.frictions.map((friction) => (
                <li key={friction.title} className="rounded-2xl border border-b1 bg-s1 p-6">
                  <h3 className="font-syne text-xl font-bold tracking-[-0.02em]">{friction.title}</h3>
                  <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
                    <span className="font-semibold text-t1">Symptom. </span>
                    {friction.symptom}
                  </p>
                  <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
                    <span className="font-semibold text-acc">Fix. </span>
                    {friction.fix}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby={`${page.slug}-strategy`} className="border-y border-b1 bg-s1/50 px-6 py-16 md:px-12">
          <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 id={`${page.slug}-strategy`} className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
                What we would change
              </h2>
              <p className="mt-4 font-dm text-base leading-relaxed text-t2">
                A practical plan for {page.pluralName}. On a first conversation we would ask: {page.unknowns.join("; ")}.
              </p>
            </div>
            <ol className="grid gap-4">
              {page.strategy.map((item, index) => (
                <li key={item.title} className="rounded-xl border border-b1 bg-s2/60 p-5">
                  <p className="font-dm text-[11px] font-semibold uppercase tracking-[0.14em] text-acc">0{index + 1}</p>
                  <h3 className="mt-2 font-syne text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <IndustryPathways page={page} />

        <section aria-labelledby={`${page.slug}-journey`} className="px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 id={`${page.slug}-journey`} className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              Example customer journey
            </h2>
            <ol className="mt-10 grid gap-3 md:grid-cols-5">
              {page.journey.map((step, index) => (
                <li key={step.title} className="rounded-xl border border-b1 bg-s1 p-4">
                  <p className="font-dm text-[11px] font-semibold uppercase tracking-[0.14em] text-t3">Step {index + 1}</p>
                  <h3 className="mt-2 font-syne text-base font-bold">{step.title}</h3>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{step.description}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 font-dm text-sm text-t3">
              Signals worth reviewing with you: {page.meaningfulMetrics.join(" · ")}. These are conversation points, not promised results.
            </p>
          </div>
        </section>

        <section aria-labelledby={`${page.slug}-proof`} className="border-y border-b1 bg-s1/40 px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">{PROOF_BADGE[page.proof.level]}</p>
            <h2 id={`${page.slug}-proof`} className="mt-2 font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              {page.proof.label}
            </h2>
            <p className="mt-4 max-w-[720px] font-dm text-sm leading-relaxed text-t3">{PROOF_LEGEND[page.proof.level]}</p>
            <p className="mt-4 max-w-[720px] font-dm text-base leading-relaxed text-t2">{page.proof.summary}</p>
            {proofStudies.length > 0 ? (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {proofStudies.map((study) => (
                  <ProjectCard key={study.slug} study={study} />
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby={`${page.slug}-faq`} className="px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[900px]">
            <h2 id={`${page.slug}-faq`} className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              Answers for business owners
            </h2>
            <div className="mt-8 grid gap-3">
              {page.faqs.map((faq) => (
                <details key={faq.q} className="group rounded-xl border border-b1 bg-s1 p-5 open:border-acc/30">
                  <summary className="flex cursor-pointer list-none items-start gap-3 font-syne text-lg font-bold tracking-[-0.02em]">
                    <CircleHelp className="mt-1 size-4 shrink-0 text-acc" aria-hidden="true" />
                    <span>{faq.q}</span>
                  </summary>
                  <p className="mt-3 pl-7 font-dm text-sm leading-relaxed text-t2">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby={`${page.slug}-next`} className="border-t border-b1 px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 id={`${page.slug}-next`} className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              What happens next
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-5">
              {[
                ["Conversation", "Tell us what is holding the business back."],
                ["Discovery", "We examine journey, systems and constraints."],
                ["Proposal", "A written scope and price in GBP."],
                ["Delivery", "Founder-led build or partnership work."],
                ["Measurement", "Track signals that matter for this industry."],
              ].map(([title, body]) => (
                <li key={title} className="rounded-xl border border-b1 bg-s1 p-4">
                  <h3 className="font-syne text-base font-bold">{title}</h3>
                  <p className="mt-2 font-dm text-sm text-t2">{body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-12 rounded-3xl border border-acc/30 bg-gradient-to-br from-s2 via-s1 to-acc/[0.08] p-8 md:p-12">
              <h3 className="font-syne text-[clamp(24px,3vw,36px)] font-extrabold tracking-[-0.025em]">
                Show us what is holding your business back
              </h3>
              <p className="mt-3 max-w-[640px] font-dm text-base text-t2">
                ScaleSmiths is based in Hucknall, Nottinghamshire, and works with businesses across the UK and remotely where the work can be delivered properly.
              </p>
              <IndustryHeroCtas page={page} />
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="font-syne text-xl font-bold">Related solutions</h3>
                <ul className="mt-4 grid gap-2">
                  {page.relatedSolutionHrefs.map((href) => (
                    <li key={href}>
                      <Link href={href} prefetch={false} className="footer-link inline-flex items-center gap-2 font-dm text-sm text-t2">
                        {routeLabel(href)} <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-syne text-xl font-bold">Related industries</h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {related.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        className="inline-flex rounded-lg border border-b2 px-3 py-1.5 font-dm text-sm capitalize text-t2 hover:border-acc/40 hover:text-t1"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href="/industries" prefetch={false} className="inline-flex rounded-lg border border-b2 px-3 py-1.5 font-dm text-sm text-acc">
                      All industries
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </section>

        <FounderStrip
          headingId={`${page.slug}-founders`}
          intro={`Direct founder accountability for ${page.pluralName}: strategy, commercial direction and implementation stay with the people you speak to.`}
        />
      </article>
    </>
  )
}
