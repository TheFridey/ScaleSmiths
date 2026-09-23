import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk").replace(/\/+$/, "")
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/_next/static/", "/_next/image/", "/brand/", "/images/"],
      disallow: [
        "/api/",
        "/portal/",
        "/quote/thanks",
        "/services/business-growth-audit/start",
        "/services/business-growth-audit/thanks",
        "/services/managed-business-email/get-started",
        "/services/managed-business-email/thanks",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
