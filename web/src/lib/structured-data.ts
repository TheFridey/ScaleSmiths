import { projectImageAlt, type Project } from "./data"
import { aboutMetadata, founderFocusAreas, founderLinks, founders, type Founder } from "./founders"
import { INSIGHT_CATEGORIES, insightAuthor, insightWordCount, type Insight } from "./insights"
import { legalEntity } from "./legal"
import { sameAsUrls, type PublicEnv } from "./public-links"
import {
  BUSINESS_LOCATION,
  CONTACT_EMAIL,
  LOGO_ASSET,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SLOGAN,
  founderProfilePath,
  organizationId,
  organizationProfiles,
  personId,
  websiteId,
} from "./site-identity"
import { teamImages } from "./team-images"

/**
 * One connected entity graph. The root layout publishes the Organization and WebSite nodes
 * on every page; page-level schema refers to them by `@id` instead of re-declaring
 * ScaleSmiths with different properties.
 */

const CONTEXT = "https://schema.org"

const postalAddress = {
  "@type": "PostalAddress",
  addressLocality: BUSINESS_LOCATION.locality,
  addressRegion: BUSINESS_LOCATION.region,
  addressCountry: BUSINESS_LOCATION.countryCode,
} as const

export function buildOrganizationSchema(base: string, env?: PublicEnv) {
  const sameAs = sameAsUrls(organizationProfiles(env))
  const logo = `${base}${LOGO_ASSET.src}`

  return {
    "@context": CONTEXT,
    "@type": ["Organization", "ProfessionalService"],
    "@id": organizationId(base),
    name: SITE_NAME,
    ...(legalEntity.legalName ? { legalName: legalEntity.legalName } : {}),
    url: base,
    logo: { "@type": "ImageObject", url: logo },
    image: logo,
    description: SITE_DESCRIPTION,
    slogan: SITE_SLOGAN,
    email: CONTACT_EMAIL,
    founder: founders.map((founder) => ({
      "@type": "Person",
      "@id": personId(base, founder.slug),
      name: founder.name,
      url: `${base}${founderProfilePath(founder.slug)}`,
    })),
    address: { ...postalAddress, postalCode: BUSINESS_LOCATION.postalCode },
    geo: { "@type": "GeoCoordinates", latitude: 53.0386, longitude: -1.2042 },
    foundingLocation: {
      "@type": "Place",
      name: `${BUSINESS_LOCATION.locality}, ${BUSINESS_LOCATION.region}`,
      address: postalAddress,
    },
    areaServed: [
      { "@type": "City", name: "Hucknall" },
      { "@type": "City", name: "Nottingham" },
      { "@type": "AdministrativeArea", name: "Nottinghamshire" },
      { "@type": "AdministrativeArea", name: "East Midlands" },
      { "@type": "Country", name: BUSINESS_LOCATION.country },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer enquiries",
      email: CONTACT_EMAIL,
      areaServed: BUSINESS_LOCATION.countryCode,
      availableLanguage: "en-GB",
    },
    knowsAbout: ["Digital Growth Strategy", "Web Design", "Web Development", "E-Commerce Development", "AI Implementation", "Business Automation", "Conversion Optimisation", "Technical SEO"],
    ...(sameAs.length ? { sameAs } : {}),
  }
}

export function buildWebsiteSchema(base: string) {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": websiteId(base),
    name: SITE_NAME,
    url: base,
    inLanguage: "en-GB",
    publisher: { "@id": organizationId(base) },
  }
}

export function buildBreadcrumbSchema(base: string, trail: Array<{ name: string; path: string }>) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path === "/" ? base : `${base}${item.path}`,
    })),
  }
}

export function buildPersonSchema(founder: Founder, base: string, env?: PublicEnv) {
  const sameAs = sameAsUrls(founderLinks(founder, env))
  const photo = teamImages[founder.photo]

  return {
    "@context": CONTEXT,
    "@type": "Person",
    "@id": personId(base, founder.slug),
    name: founder.name,
    jobTitle: founder.authorTitle,
    description: founder.summary.text,
    url: `${base}${founderProfilePath(founder.slug)}`,
    ...(photo.available ? { image: `${base}${photo.src}` } : {}),
    worksFor: { "@id": organizationId(base) },
    knowsAbout: founderFocusAreas(founder),
    workLocation: {
      "@type": "Place",
      name: `${BUSINESS_LOCATION.locality}, ${BUSINESS_LOCATION.region}`,
      address: postalAddress,
    },
    ...(sameAs.length ? { sameAs } : {}),
  }
}

export function buildAboutSchemas(base: string, env?: PublicEnv) {
  const url = `${base}/about`
  return [
    {
      "@context": CONTEXT,
      "@type": "AboutPage",
      name: "About ScaleSmiths and its founders",
      description: String(aboutMetadata.description),
      url,
      isPartOf: { "@id": websiteId(base) },
      about: { "@id": organizationId(base) },
      mentions: founders.map((founder) => ({ "@id": personId(base, founder.slug) })),
    },
    ...founders.map((founder) => buildPersonSchema(founder, base, env)),
    buildBreadcrumbSchema(base, [
      { name: "Home", path: "/" },
      { name: "About", path: "/about" },
    ]),
  ]
}

export function buildFounderProfileSchemas(founder: Founder, base: string, env?: PublicEnv) {
  const path = founderProfilePath(founder.slug)
  return [
    {
      "@context": CONTEXT,
      "@type": "ProfilePage",
      name: `${founder.name} — Co-founder of ScaleSmiths`,
      url: `${base}${path}`,
      isPartOf: { "@id": websiteId(base) },
      mainEntity: buildPersonSchema(founder, base, env),
    },
    buildBreadcrumbSchema(base, [
      { name: "Home", path: "/" },
      { name: "About", path: "/about" },
      { name: founder.name, path },
    ]),
  ]
}

/**
 * BlogPosting for founder-written articles. The author node uses the same `@id`, name and
 * profile URL as the founder profile page, so the byline a reader sees and the schema match.
 */
export function buildInsightSchemas(insight: Insight, base: string) {
  const path = `/insights/${insight.slug}`
  const url = `${base}${path}`
  const author = insightAuthor(insight)
  return [
    {
      "@context": CONTEXT,
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: insight.title,
      description: insight.description,
      url,
      mainEntityOfPage: url,
      inLanguage: "en-GB",
      ...(insight.datePublished ? { datePublished: insight.datePublished } : {}),
      ...(insight.dateModified || insight.datePublished ? { dateModified: insight.dateModified ?? insight.datePublished } : {}),
      ...(insight.heroImage ? { image: { "@type": "ImageObject", url: `${base}${insight.heroImage.src}`, caption: insight.heroImage.alt } } : {}),
      author: {
        "@type": "Person",
        "@id": personId(base, author.slug),
        name: author.name,
        jobTitle: author.authorTitle,
        url: `${base}${founderProfilePath(author.slug)}`,
      },
      publisher: { "@id": organizationId(base) },
      articleSection: INSIGHT_CATEGORIES[insight.category].label,
      wordCount: insightWordCount(insight),
      isPartOf: { "@id": websiteId(base) },
    },
    buildBreadcrumbSchema(base, [
      { name: "Home", path: "/" },
      { name: "Insights", path: "/insights" },
      { name: insight.title, path },
    ]),
  ]
}

export function buildCaseStudySchemas(project: Project, base: string, founder?: Founder, image?: { src: string; alt: string }) {
  const path = `/work/${project.slug}`
  const primary = image ?? (project.heroImage ? { src: project.heroImage, alt: projectImageAlt(project) } : undefined)
  return [
    {
      "@context": CONTEXT,
      "@type": "Article",
      headline: `${project.name}: ${project.type} case study`,
      description: project.headline,
      url: `${base}${path}`,
      mainEntityOfPage: `${base}${path}`,
      inLanguage: "en-GB",
      ...(primary ? { image: { "@type": "ImageObject", url: `${base}${primary.src}`, caption: primary.alt } } : {}),
      author: { "@id": organizationId(base), name: SITE_NAME },
      ...(founder ? { contributor: { "@id": personId(base, founder.slug), name: founder.name } } : {}),
      publisher: { "@id": organizationId(base) },
      about: { "@type": "Thing", name: project.name },
      keywords: project.tags.join(", "),
      isPartOf: { "@id": websiteId(base) },
    },
    buildBreadcrumbSchema(base, [
      { name: "Home", path: "/" },
      { name: "Work", path: "/work" },
      { name: project.name, path },
    ]),
  ]
}
