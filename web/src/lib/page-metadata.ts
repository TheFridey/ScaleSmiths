import type { Metadata } from "next"
import { SITE_NAME } from "./site-identity"

export interface PageMetadataInput {
  /** Page title without the brand suffix; the root layout template appends "| ScaleSmiths". */
  title: string
  /**
   * A complete title that already names ScaleSmiths where it reads naturally, e.g.
   * "Web Design in Hucknall, Nottinghamshire | ScaleSmiths". Bypasses the layout template.
   */
  absoluteTitle?: string
  description: string
  /** Root-relative canonical path, e.g. "/about/rhys". */
  path: string
  type?: "website" | "article" | "profile"
  image?: { url: string; width?: number; height?: number; alt: string }
  robots?: Metadata["robots"]
}

/**
 * Consistent per-page title, description, canonical, Open Graph and X card values.
 * Next.js replaces (rather than merges) nested `openGraph`/`twitter` objects, so each page
 * must supply complete values or it silently inherits the homepage's social copy.
 */
export function buildPageMetadata({ title, absoluteTitle, description, path, type = "website", image, robots }: PageMetadataInput): Metadata {
  const socialTitle = absoluteTitle ?? `${title} | ${SITE_NAME}`
  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: "en_GB",
      siteName: SITE_NAME,
      url: path,
      title: socialTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
    ...(robots ? { robots } : {}),
  }
}
