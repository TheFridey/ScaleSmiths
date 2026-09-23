import type { FaqId } from "./faq-library"
import { buildPageMetadata } from "./page-metadata"

export interface LocationPageData {
  slug: "nottingham" | "hucknall"
  title: string
  metaTitle: string
  description: string
  eyebrow: string
  h1: string
  intro: string
  sections: Array<{ title: string; paragraphs: string[] }>
  services: Array<{ href: string; title: string; description: string }>
  proofLinks: string[]
  /** Questions specific to working in this place. */
  faqs: Array<{ q: string; a: string }>
  /** Shared knowledge-base answers a local buyer also asks. */
  faqLibrary: readonly FaqId[]
}

export const locationPages: Record<LocationPageData["slug"], LocationPageData> = {
  nottingham: {
    slug: "nottingham",
    title: "Nottingham",
    metaTitle: "Web Design & Development Nottingham | ScaleSmiths",
    description: "Web design, SEO, custom development and automation for Nottingham businesses, delivered directly by ScaleSmiths' Hucknall-based founders.",
    eyebrow: "Nottingham service hub",
    h1: "Websites and systems for Nottingham businesses with serious work to do.",
    intro: "ScaleSmiths serves organisations across Nottingham and Nottinghamshire from nearby Hucknall. This hub connects website, search, software and ongoing technical services without pretending every business needs the same package.",
    sections: [
      { title: "A regional hub, not a copied city page", paragraphs: ["Nottingham businesses range from local service firms to e-commerce brands and product teams. The right starting point depends on whether the constraint is positioning, visibility, an ageing website or an operational workflow behind it.", "We work directly with owners and teams across Nottinghamshire and the wider East Midlands, while continuing to deliver nationally where the fit is right."] },
      { title: "How local and technical work connect", paragraphs: ["A local-service website may need clear coverage, proof and a useful quote journey. A growing team may need integrations, a portal or automation. ScaleSmiths can treat those as parts of one digital estate instead of isolated supplier tasks.", "Published Nottinghamshire work includes local search architecture, custom enquiry paths, operational systems and ongoing measurement. The case studies below state what was actually delivered without inventing commercial outcomes."] },
    ],
    services: [
      { href: "/web-design-nottingham", title: "Web design Nottingham", description: "Custom, search-ready websites structured around services, proof and enquiries." },
      { href: "/website-redesign-nottingham", title: "Website redesign", description: "Evidence-led rebuilds that protect useful routes and improve the complete journey." },
      { href: "/local-seo-nottingham", title: "Local SEO", description: "Technical, content and conversion work without clone location pages." },
      { href: "/web-development-nottingham", title: "Custom web development", description: "Integrations, admin tools, data and application features." },
      { href: "/business-automation-nottingham", title: "Business automation", description: "Controlled workflows that reduce repeated handling and keep exceptions visible." },
      { href: "/website-maintenance-nottingham", title: "Website maintenance", description: "A documented support boundary for updates, incidents and improvement work." },
    ],
    proofLinks: ["confirm-a-kill", "precision-finish-plastering-rendering", "glow-tanning"],
    faqs: [
      { q: "Where is ScaleSmiths based?", a: "ScaleSmiths is based in Hucknall, Nottinghamshire, on the northern edge of Nottingham, and works with businesses locally and across the UK." },
      { q: "Can Nottingham projects include in-person meetings?", a: "Yes, where an in-person discovery or working session will materially help the project. Most delivery and review work can also run remotely." },
      { q: "Do you only work with Nottingham businesses?", a: "No. Nottinghamshire is the initial geographic focus, but ScaleSmiths works nationally and has published work outside the UK." },
    ],
    faqLibrary: ["what-is-local-seo", "cost", "timeline", "rebuilds", "seo-in-build", "established-businesses", "support"],
  },
  hucknall: {
    slug: "hucknall",
    title: "Hucknall",
    metaTitle: "Web Design & Digital Services Hucknall | ScaleSmiths",
    description: "Hucknall-based web design, local SEO and custom development from ScaleSmiths, with nearby published work and direct founder delivery.",
    eyebrow: "Home of ScaleSmiths",
    h1: "Digital work delivered from Hucknall, with nearby businesses in the portfolio.",
    intro: "ScaleSmiths is based in Hucknall. Local businesses work directly with the two founders who scope, design and build the work, with in-person discovery available when it makes the project clearer.",
    sections: [
      { title: "A genuine local connection", paragraphs: ["Hucknall is not simply a place name added for search. It is where ScaleSmiths is based and where published client work includes Glow Tanning and Precision Finish Plastering & Rendering.", "That proximity can make early discovery easier for a local owner, but the same standards apply: useful content, accurate claims and technology chosen around the business."] },
      { title: "What nearby businesses usually need", paragraphs: ["A local website has to explain the offer quickly, work properly on a phone, show credible evidence and make the next step obvious. Search architecture should describe real services and coverage instead of producing dozens of thin area pages.", "Where the operational problem sits behind the website, ScaleSmiths can also build quote workflows, admin tools, integrations and ongoing managed support."] },
    ],
    services: [
      { href: "/web-design-hucknall", title: "Web design Hucknall", description: "The detailed service page for local website design and build." },
      { href: "/local-seo-nottingham", title: "Local SEO", description: "Search and conversion foundations for businesses serving Hucknall and Nottinghamshire." },
      { href: "/website-redesign-nottingham", title: "Website redesign", description: "Replace an ageing site while protecting useful content and URLs." },
      { href: "/managed-website-hosting", title: "Managed hosting", description: "Hosting, deployment and support with responsibilities written down." },
    ],
    proofLinks: ["glow-tanning", "precision-finish-plastering-rendering"],
    faqs: [
      { q: "Is ScaleSmiths actually in Hucknall?", a: "Yes. ScaleSmiths is run from Hucknall by founders Rhys and Trevor Newton-Bradley." },
      { q: "Can you visit our Hucknall business?", a: "Yes, when an in-person session is useful and agreed as part of discovery or delivery." },
      { q: "Do you build only local-business websites?", a: "No. The portfolio includes local websites, e-commerce, SaaS products, portals and custom systems for organisations in the UK and beyond." },
    ],
    faqLibrary: ["what-is-local-seo", "cost", "timeline", "project-inputs", "website-ownership", "support", "outside-nottingham"],
  },
}

export function metadataForLocation(page: LocationPageData) {
  return buildPageMetadata({ title: page.title, absoluteTitle: page.metaTitle, description: page.description, path: `/locations/${page.slug}` })
}
