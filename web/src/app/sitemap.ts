import type { MetadataRoute } from "next"
import { projects } from "@/lib/data"
import { landingPages } from "@/lib/landing-pages"
import { buildLogs } from "@/lib/build-logs"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk"
  return [
    { url: base,                  lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${base}/work`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/services`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/pricing`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/quote`,       lastModified: new Date(), changeFrequency: "yearly",  priority: 0.7 },
    ...Object.values(landingPages).map((page) => ({
      url:              `${base}/${page.slug}`,
      lastModified:     new Date(),
      changeFrequency:  "monthly" as const,
      priority:         0.85,
    })),
    ...projects.map((p) => ({
      url:              `${base}/work/${p.slug}`,
      lastModified:     new Date(),
      changeFrequency:  "monthly" as const,
      priority:         0.8,
    })),
    ...buildLogs.map((log) => ({
      url:              `${base}/work/${log.slug}`,
      lastModified:     new Date(),
      changeFrequency:  "monthly" as const,
      priority:         0.75,
    })),
  ]
}
