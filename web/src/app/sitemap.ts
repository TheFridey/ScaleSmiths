import type { MetadataRoute } from "next"
import { buildPublicSitemap } from "@/lib/public-sitemap"

export default function sitemap(): MetadataRoute.Sitemap {
  return buildPublicSitemap(process.env.NEXT_PUBLIC_SITE_URL)
}
