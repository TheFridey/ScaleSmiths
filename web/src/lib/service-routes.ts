import { landingPages } from "./landing-pages"
import { locationPages } from "./location-pages"
import { serviceJourneys } from "./service-journeys"

export interface ServiceRoute {
  href: string
  label: string
  description: string
}

/**
 * Every commercial page an article, case study or founder profile may link to, with a label
 * written for readers. Links to unknown routes are rejected by tests rather than rendered.
 */
export function serviceRouteCatalogue(): Map<string, ServiceRoute> {
  const routes: ServiceRoute[] = [
    ...Object.values(serviceJourneys).map((journey) => ({ href: `/${journey.slug}`, label: journey.eyebrow, description: journey.description })),
    ...Object.values(landingPages).map((page) => ({ href: `/${page.slug}`, label: page.title, description: page.description })),
    { href: "/services", label: "All services", description: "Websites, local growth, custom systems, email, audits and ongoing partnership." },
    { href: "/enterprise", label: "Enterprise", description: "Bespoke operational platforms, internal systems, integrations and multi-site software for complex organisations." },
    { href: "/digital-growth-partnership", label: "Digital Growth Partnership", description: "Ongoing improvement across search, conversion, content and technical stewardship, scoped around agreed priorities." },
    { href: "/services/business-growth-audit", label: "Business Growth Audit", description: "A structured review of visibility, trust, enquiries and systems, with a prioritised roadmap." },
    { href: "/services/managed-business-email", label: "Managed Business Email", description: "Professional custom-domain email configured, authenticated and supported by ScaleSmiths." },
    { href: "/pricing", label: "Pricing guidance", description: "How ScaleSmiths scopes and prices projects and ongoing work." },
  ]
  return new Map(routes.map((route) => [route.href, route]))
}

/**
 * A reader-facing label for any internal route used in a link list, so navigation never falls
 * back to a de-slugged URL. Location hubs are included because the services hub links to them.
 */
export function routeLabel(href: string): string {
  const route = serviceRouteCatalogue().get(href)
  if (route) return route.label
  const locationSlug = href.startsWith("/locations/") ? href.slice("/locations/".length) : undefined
  const location = locationSlug ? locationPages[locationSlug as keyof typeof locationPages] : undefined
  if (location) return `${location.title} service hub`
  const last = href.split("/").filter(Boolean).at(-1) ?? href
  return last.replaceAll("-", " ").replace(/^./, (character) => character.toUpperCase())
}

export function serviceRoutes(hrefs: readonly string[]): ServiceRoute[] {
  const catalogue = serviceRouteCatalogue()
  return hrefs.map((href) => catalogue.get(href)).filter((route): route is ServiceRoute => Boolean(route))
}
