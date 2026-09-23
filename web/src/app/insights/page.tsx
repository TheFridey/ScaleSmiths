import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { InsightCard } from "@/components/insights/InsightCard"
import { JsonLd } from "@/components/JsonLd"
import { INSIGHT_TOPIC_CLUSTERS, publishedInsights, type InsightTopicSlug } from "@/lib/insights"
import { buildPageMetadata } from "@/lib/page-metadata"
import { siteBaseUrl, websiteId, organizationId } from "@/lib/site-identity"
import { buildBreadcrumbSchema } from "@/lib/structured-data"

const baseMetadata = buildPageMetadata({
  title: "Insights",
  absoluteTitle: "Insights on Websites, SEO & Development | ScaleSmiths",
  description: "Practical guidance from ScaleSmiths on websites, SEO, development, automation, hosting and business email, written by the founders doing the work.",
  path: "/insights",
})
export const metadata: Metadata = { ...baseMetadata, alternates: { ...baseMetadata.alternates, types: { "application/rss+xml": "/feed.xml" } } }

export default function InsightsPage() {
  const articles = publishedInsights()
  const featured = articles.find((article) => article.featured) ?? articles[0]
  const latest = articles.filter((article) => article.slug !== featured.slug).slice(0, 8)
  const topics = Object.entries(INSIGHT_TOPIC_CLUSTERS) as Array<[InsightTopicSlug, (typeof INSIGHT_TOPIC_CLUSTERS)[InsightTopicSlug]]>
  const base = siteBaseUrl()
  return <>
    <JsonLd data={[
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "ScaleSmiths Insights", description: String(metadata.description), url: `${base}/insights`, isPartOf: { "@id": websiteId(base) }, publisher: { "@id": organizationId(base) }, hasPart: articles.map((article) => ({ "@type": "BlogPosting", headline: article.title, url: `${base}/insights/${article.slug}` })) },
      buildBreadcrumbSchema(base, [{ name: "Home", path: "/" }, { name: "Insights", path: "/insights" }]),
    ]} />
    <main>
      <header className="px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14"><div className="mx-auto max-w-[1240px]"><Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Insights" }]} /><div className="mt-10 max-w-[860px]"><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Insights</p><h1 className="mt-3 font-syne text-[clamp(40px,7vw,78px)] font-black leading-[1.02] tracking-[-.04em]">Useful answers from the people doing the work.</h1><p className="mt-6 max-w-[760px] text-lg leading-relaxed text-t2">Websites, search, development and infrastructure explained without inflated promises. Each article connects the decision to relevant services, delivery evidence and the next useful question.</p><Link href="/feed.xml" className="mt-6 inline-flex text-sm font-semibold text-acc hover:underline">Subscribe via RSS</Link></div></div></header>

      <section aria-labelledby="featured-insight" className="border-y border-b1 bg-s1/40 px-6 py-16 md:px-12"><div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Featured insight</p><h2 id="featured-insight" className="mt-3 font-syne text-[clamp(30px,4.5vw,52px)] font-extrabold tracking-[-.03em]">{featured.title}</h2><p className="mt-5 max-w-[680px] text-base leading-relaxed text-t2">{featured.description}</p><Link href={`/insights/${featured.slug}`} prefetch={false} className="btn-primary mt-7">Read the guide <ArrowRight size={16} aria-hidden="true" /></Link></div><div className="rounded-3xl border border-acc/20 bg-gradient-to-br from-s2 to-acc/5 p-8 md:p-12"><p className="font-syne text-2xl font-bold">A practical starting point</p><p className="mt-4 text-sm leading-[1.8] text-t2">Start with scope, ownership and the problem the website or system must solve. The related guides below help you compare platforms, timelines and ongoing responsibilities without pretending one answer fits every business.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/services" className="btn-ghost">Explore services</Link><Link href="/work" className="btn-ghost">See delivered work</Link></div></div></div></section>

      <section aria-labelledby="insight-topics" className="px-6 py-20 md:px-12"><div className="mx-auto max-w-[1240px]"><div className="max-w-[720px]"><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Topic library</p><h2 id="insight-topics" className="mt-2 font-syne text-[clamp(30px,4vw,46px)] font-extrabold">Browse by the decision in front of you.</h2></div><nav aria-label="Insight categories" className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{topics.map(([slug, topic]) => <Link key={slug} href={`/insights/${slug}`} prefetch={false} className="group rounded-2xl border border-b1 bg-s1 p-6 transition-colors hover:border-b2"><h3 className="font-syne text-xl font-bold">{topic.label}</h3><p className="mt-3 text-sm leading-relaxed text-t2">{topic.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-acc">View {topic.label.toLowerCase()} insights <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span></Link>)}</nav></div></section>

      <section aria-labelledby="latest-insights" className="px-6 py-20 md:px-12"><div className="mx-auto max-w-[1240px]"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Latest</p><h2 id="latest-insights" className="mt-2 font-syne text-[clamp(30px,4vw,46px)] font-extrabold">Recently published guidance.</h2></div><span className="text-sm text-t3">{articles.length} published articles</span></div><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{latest.map((article) => <InsightCard key={article.slug} insight={article} headingLevel="h3" />)}</div></div></section>

      <section className="px-6 pb-24 md:px-12"><div className="mx-auto grid max-w-[1240px] gap-7 rounded-3xl border border-acc/20 bg-s1 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Apply the guidance</p><h2 className="mt-3 font-syne text-3xl font-extrabold">Need the website or system reviewed in context?</h2><p className="mt-3 max-w-[720px] text-sm leading-relaxed text-t2">Explore ScaleSmiths services or start a project brief with the business problem, current estate and evidence you already have.</p></div><Link href="/quote" prefetch={false} className="btn-primary justify-center">Start a project brief <ArrowRight size={16} aria-hidden="true" /></Link></div></section>
    </main>
  </>
}
