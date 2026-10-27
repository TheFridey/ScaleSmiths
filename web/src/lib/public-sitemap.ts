import type { MetadataRoute } from "next"
import { founders } from "./founders"
import { INSIGHT_TOPIC_CLUSTERS, insightsForTopic, publishedInsights } from "./insights"
import { projects } from "./data"
import { sitemapIndustryEntries } from "./industries"
import { landingPages } from "./landing-pages"
import { legalSitemapEntries } from "./legal"
import { locationPages } from "./location-pages"

export const PUBLIC_CONTENT_LAST_MODIFIED_ISO = "2026-09-23T00:00:00.000Z"
/** Bumped only when that document's visible content changes. A shared date on every URL is not a lastmod. */
export const LOCATIONS_HUB_LAST_MODIFIED_ISO = "2026-10-27T00:00:00.000Z"
export const QUOTE_PAGE_LAST_MODIFIED_ISO = "2026-10-27T00:00:00.000Z"

export function buildPublicSitemap(siteUrl = "https://scalesmiths.co.uk"): MetadataRoute.Sitemap {
  const base = siteUrl.replace(/\/$/, "")
  const lastModified = () => new Date(PUBLIC_CONTENT_LAST_MODIFIED_ISO)
  const entries: MetadataRoute.Sitemap = [
    { url: base,                  lastModified: lastModified(), changeFrequency: "monthly", priority: 1 },
    // The planner stays indexable: the public performance budget requires its Lighthouse SEO score.
    { url: `${base}/interactive`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/work`,        lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/services`,    lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/services/managed-business-email`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/services/business-growth-audit`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/local-growth`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/custom-systems`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/enterprise`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/enterprise-websites`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/enterprise/delivery`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/enterprise/contact`, lastModified: lastModified(), changeFrequency: "yearly", priority: 0.65 },
    { url: `${base}/security`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/about`,       lastModified: lastModified(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/locations`,   lastModified: new Date(LOCATIONS_HUB_LAST_MODIFIED_ISO), changeFrequency: "monthly", priority: 0.75 },
    ...Object.values(locationPages).map((page) => ({ url: `${base}/locations/${page.slug}`, lastModified: lastModified(), changeFrequency: "monthly" as const, priority: 0.85 })),
    { url: `${base}/faq`,         lastModified: lastModified(), changeFrequency: "monthly", priority: 0.7 },
    ...founders.map((founder) => ({ url: `${base}/about/${founder.slug}`, lastModified: lastModified(), changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/contact`,     lastModified: lastModified(), changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/pricing`,     lastModified: lastModified(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/digital-growth-partnership`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/quote`,       lastModified: new Date(QUOTE_PAGE_LAST_MODIFIED_ISO), changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/local-growth-check`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.8 },
    ...sitemapIndustryEntries(base, lastModified()),
    ...legalSitemapEntries(base),
    ...Object.values(landingPages).map((page) => ({
      url: `${base}/${page.slug}`,
      lastModified: lastModified(),
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
    ...projects.map((project) => ({
      url: `${base}/work/${project.slug}`,
      lastModified: lastModified(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // The insights hub is only listed once it has published articles; drafts are never listed.
    ...(publishedInsights().length ? [{ url: `${base}/insights`, lastModified: lastModified(), changeFrequency: "weekly" as const, priority: 0.7 }] : []),
    ...(Object.keys(INSIGHT_TOPIC_CLUSTERS) as Array<keyof typeof INSIGHT_TOPIC_CLUSTERS>)
      .filter((topic) => insightsForTopic(topic).length > 0)
      .map((topic) => ({ url: `${base}/insights/${topic}`, lastModified: lastModified(), changeFrequency: "weekly" as const, priority: 0.65 })),
    ...publishedInsights().map((insight) => ({
      url: `${base}/insights/${insight.slug}`,
      lastModified: new Date(`${insight.dateModified ?? insight.datePublished}T00:00:00.000Z`),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    // Build logs stay on /work for readers. They are short production notes, so they are noindex
    // and omitted until each one is expanded into a founder article.
  ]

  const uniqueUrls = new Set(entries.map((entry) => entry.url))
  if (uniqueUrls.size !== entries.length) {
    throw new Error("Public sitemap contains duplicate URLs.")
  }

  return entries
}
