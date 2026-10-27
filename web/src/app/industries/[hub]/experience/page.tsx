import Link from "next/link"
import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { IndustryWorkflowDemo } from "@/components/industries/IndustryWorkflowDemo"
import { JsonLd } from "@/components/JsonLd"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import {
  getIndustryDemonstration,
  getIndustryHub,
  industryDemonstrationPath,
  industryDemonstrations,
  industryPath,
} from "@/lib/industries"
import { buildPageMetadata } from "@/lib/page-metadata"
import { organizationReference, siteBaseUrl, websiteId } from "@/lib/site-identity"

export function generateStaticParams() {
  return industryDemonstrations().map((item) => ({ hub: item.hubSlug }))
}

export async function generateMetadata({ params }: { params: Promise<{ hub: string }> }) {
  const { hub } = await params
  const demonstration = getIndustryDemonstration(hub)
  if (!demonstration) return {}
  return buildPageMetadata({
    title: demonstration.shortName,
    absoluteTitle: demonstration.metaTitle,
    description: demonstration.description,
    path: industryDemonstrationPath(demonstration.hubSlug),
  })
}

export default async function IndustryExperiencePage({ params }: { params: Promise<{ hub: string }> }) {
  const { hub: hubSlug } = await params
  const demonstration = getIndustryDemonstration(hubSlug)
  const hub = getIndustryHub(hubSlug)
  if (!demonstration || !hub) notFound()

  const base = siteBaseUrl()
  const url = `${base}${industryDemonstrationPath(hub.slug)}`
  const studies = demonstration.workSlug ? caseStudiesForSlugs([demonstration.workSlug]) : []
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: demonstration.metaTitle,
      description: demonstration.description,
      isPartOf: { "@id": websiteId(base) },
      about: organizationReference(base),
      inLanguage: "en-GB",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: "Industries", item: `${base}/industries` },
        { "@type": "ListItem", position: 3, name: hub.shortName, item: `${base}${industryPath(hub.slug)}` },
        { "@type": "ListItem", position: 4, name: "Workflow", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: demonstration.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ]

  return (
    <>
      <JsonLd data={schemas} />
      <main>
        <article className="px-6 py-20 md:px-12 md:py-28">
          <div className="mx-auto max-w-[1100px]">
            <Breadcrumbs
              items={[
                { name: "Home", href: "/" },
                { name: "Industries", href: "/industries" },
                { name: hub.shortName, href: industryPath(hub.slug) },
                { name: "Workflow" },
              ]}
            />
            <div className="mt-10 max-w-[760px]">
              <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">{demonstration.eyebrow}</span>
              <h1 className="page-hero-display mt-3">{demonstration.h1}</h1>
              <p className="mt-6 font-dm text-lg leading-relaxed text-t2">{demonstration.intro}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`/quote?intent=strategy_call&industry=${hub.slug}&hub=${hub.slug}&pathway=growth`} prefetch={false} className="btn-primary font-dm">
                  Talk through this workflow
                </Link>
                <Link href={industryPath(hub.slug)} prefetch={false} className="btn-ghost font-dm">
                  Specialist pages
                </Link>
              </div>
            </div>
            <IndustryWorkflowDemo demonstration={demonstration} />
            <section aria-labelledby="workflow-proof" className="mt-16 rounded-2xl border border-b1 bg-s1 p-6 md:p-8">
              <h2 id="workflow-proof" className="font-syne text-2xl font-bold">{demonstration.proofLabel}</h2>
              <p className="mt-3 max-w-[720px] font-dm text-sm leading-relaxed text-t2">{demonstration.proofSummary}</p>
              {studies.length > 0 ? (
                <div className="mt-6 max-w-[420px]">
                  <ProjectCard study={studies[0]} />
                </div>
              ) : null}
            </section>
            <section aria-labelledby="workflow-faqs" className="mt-16">
              <h2 id="workflow-faqs" className="font-syne text-2xl font-bold">Questions about this workflow</h2>
              <div className="mt-6 grid gap-4">
                {demonstration.faqs.map((faq) => (
                  <details key={faq.q} className="rounded-xl border border-b1 bg-s1 p-5">
                    <summary className="cursor-pointer font-syne text-lg font-bold">{faq.q}</summary>
                    <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{faq.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </article>
      </main>
    </>
  )
}
