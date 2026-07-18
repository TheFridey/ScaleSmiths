import type { MetadataRoute } from "next"
import { buildLogs } from "./build-logs"
import { projects } from "./data"
import { landingPages } from "./landing-pages"
import { legalSitemapEntries } from "./legal"

export const PUBLIC_CONTENT_LAST_MODIFIED_ISO = "2026-07-18T00:00:00.000Z"

export function buildPublicSitemap(siteUrl = "https://scalesmiths.co.uk"): MetadataRoute.Sitemap {
  const base = siteUrl.replace(/\/$/, "")
  const lastModified = () => new Date(PUBLIC_CONTENT_LAST_MODIFIED_ISO)
  const entries: MetadataRoute.Sitemap = [
    { url: base,                  lastModified: lastModified(), changeFrequency: "monthly", priority: 1 },
    { url: `${base}/interactive`, lastModified: lastModified(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/work`,        lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/services`,    lastModified: lastModified(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/pricing`,     lastModified: lastModified(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/quote`,       lastModified: lastModified(), changeFrequency: "yearly", priority: 0.7 },
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
    ...buildLogs.map((log) => ({
      url: `${base}/work/${log.slug}`,
      lastModified: lastModified(),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ]

  const uniqueUrls = new Set(entries.map((entry) => entry.url))
  if (uniqueUrls.size !== entries.length) {
    throw new Error("Public sitemap contains duplicate URLs.")
  }

  return entries
}
