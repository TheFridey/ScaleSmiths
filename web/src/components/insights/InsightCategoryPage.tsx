import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { InsightCard } from "./InsightCard"
import { INSIGHT_TOPIC_CLUSTERS, insightsForTopic, type InsightTopicSlug } from "@/lib/insights"
import { FAQ_CATEGORY_FOR_INSIGHT_TOPIC } from "@/lib/faq-knowledge-base"
import { siteBaseUrl, websiteId } from "@/lib/site-identity"
import { buildBreadcrumbSchema } from "@/lib/structured-data"
import { serviceRoutes } from "@/lib/service-routes"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import { ProjectCard } from "@/components/work/ProjectCard"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function InsightCategoryPage({ topic }: { topic: InsightTopicSlug }) {
  const cluster = INSIGHT_TOPIC_CLUSTERS[topic]
  const articles = insightsForTopic(topic)
  if (!articles.length) notFound()
  const base = siteBaseUrl()
  const path = `/insights/${topic}`
  const services = serviceRoutes([...new Set(articles.flatMap((article) => article.relatedServices))]).slice(0, 4)
  const studies = caseStudiesForSlugs([...new Set(articles.flatMap((article) => article.relatedCaseStudies))]).slice(0, 3)
  const faqCategory = FAQ_CATEGORY_FOR_INSIGHT_TOPIC[topic]
  const schema = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: `${cluster.label} insights`, description: cluster.description, url: `${base}${path}`, isPartOf: { "@id": websiteId(base) }, hasPart: articles.map((article) => ({ "@type": "BlogPosting", url: `${base}/insights/${article.slug}`, headline: article.title })) },
    buildBreadcrumbSchema(base, [{ name: "Home", path: "/" }, { name: "Insights", path: "/insights" }, { name: cluster.label, path }]),
  ]
  return (
    <>
      <JsonLd data={schema} />
      <main className="px-6 pb-24 pt-10 md:px-12 md:pt-14">
        <div className="mx-auto max-w-[1240px]">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Insights", href: "/insights" }, { name: cluster.label }]} />
          <header className="mt-10 max-w-[820px]">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Insights topic</p>
            <h1 className="mt-3 font-syne text-[clamp(38px,6.5vw,72px)] font-black tracking-[-.04em]">{cluster.label}</h1>
            <p className="mt-5 text-lg leading-relaxed text-t2">{cluster.description}</p>
          </header>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{articles.map((article) => <InsightCard key={article.slug} insight={article} headingLevel="h2" />)}</div>
          {services.length ? <section aria-labelledby={`${topic}-services`} className="mt-20"><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Put it into practice</p><h2 id={`${topic}-services`} className="mt-2 font-syne text-3xl font-extrabold">Related ScaleSmiths services</h2><div className="mt-6 grid gap-4 md:grid-cols-2">{services.map((service) => <Link key={service.href} href={service.href} prefetch={false} className="group rounded-2xl border border-b1 bg-s1 p-6"><h3 className="font-syne text-xl font-bold">{service.label}</h3><p className="mt-3 text-sm leading-relaxed text-t2">{service.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-acc">Explore service <ArrowRight size={14} aria-hidden="true" /></span></Link>)}</div></section> : null}
          {studies.length ? <section aria-labelledby={`${topic}-work`} className="mt-20"><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Relevant proof</p><h2 id={`${topic}-work`} className="mt-2 font-syne text-3xl font-extrabold">Work connected to this topic</h2><div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{studies.map((study) => <ProjectCard key={study.slug} study={study} size="compact" />)}</div></section> : null}
          <section aria-labelledby={`${topic}-next`} className="mt-20 grid gap-8 rounded-3xl border border-acc/20 bg-acc/[.05] p-8 md:p-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Where to go next</p>
              <h2 id={`${topic}-next`} className="mt-2 font-syne text-[clamp(26px,3.4vw,38px)] font-extrabold tracking-[-.03em]">Reading is the cheap part.</h2>
              <p className="mt-4 max-w-[560px] text-sm leading-relaxed text-t2">
                If one of these articles describes your situation, the quickest way to know what it means for your website is to have someone look at it.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/quote" prefetch={false} className="btn-primary">Discuss a project <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/services/business-growth-audit" prefetch={false} className="btn-ghost">Request an audit</Link>
              {faqCategory ? <Link href={`/faq#${faqCategory}`} prefetch={false} className="btn-ghost">Short answers on {cluster.label.toLowerCase()}</Link> : null}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
