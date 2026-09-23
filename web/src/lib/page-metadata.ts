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
  authors?: Array<{ name: string; url?: string }>
  publishedTime?: string
  modifiedTime?: string
  section?: string
}

/**
 * Consistent per-page title, description, canonical, Open Graph and X card values.
 * Next.js replaces (rather than merges) nested `openGraph`/`twitter` objects, so each page
 * must supply complete values or it silently inherits the homepage's social copy.
 */
export function buildPageMetadata({ title, absoluteTitle, description, path, type = "website", image, robots, authors, publishedTime, modifiedTime, section }: PageMetadataInput): Metadata {
  const socialTitle = absoluteTitle ?? `${title} | ${SITE_NAME}`
  const socialImage = image ?? { url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE_NAME} â€” Forge Your Digital Edge` }
  const article = type === "article" ? {
    ...(publishedTime ? { publishedTime } : {}),
    ...(modifiedTime ? { modifiedTime } : {}),
    ...(section ? { section } : {}),
    ...(authors?.length ? { authors: authors.map((author) => author.name) } : {}),
  } : {}
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
      images: [socialImage],
      ...article,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage.url],
    },
    ...(authors?.length ? { authors } : {}),
    ...(robots ? { robots } : {}),
  }
}
