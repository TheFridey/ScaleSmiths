import type { Metadata } from "next"
import { enquiryIntentHref } from "./enquiry-intents"
import { buildPageMetadata } from "./page-metadata"
import { organizationReference, siteBaseUrl } from "./site-identity"

export const ENTERPRISE_WEBSITES_PATH = "/enterprise-websites"

/** Technical platforms used as engineering proof, not named enterprise endorsements. */
export const ENTERPRISE_WEBSITES_PROOF_SLUGS = [
  "veteranfinder",
  "prymal",
  "the-business-circle",
  "pinkys-prints",
] as const

export const enterpriseWebsitesCopy = {
  metaTitle: "Enterprise Websites & Digital Experiences",
  metaDescription:
    "Corporate websites and digital experiences engineered around your organisation: journey architecture, integrations, visibility and migration continuity. Founder-led, requirements-first.",
  eyebrow: "Enterprise websites",
  title: "Enterprise Websites & Digital Experiences Built Around Your Organisation.",
  lede:
    "ScaleSmiths designs and engineers corporate websites and connected digital experiences for organisations that need more than a marketing brochure. We assess whether to improve, integrate or rebuild, then deliver around real journeys, systems and operational constraints, without prescribing a technology stack before requirements are understood.",
  primaryCta: {
    label: "Discuss Your Digital Transformation",
    href: enquiryIntentHref("enterprise"),
  },
  secondaryCta: {
    label: "View Engineering Work",
    href: "/work#engineering-complex-systems",
  },
  relatedSystemsCta: {
    label: "Enterprise operational software",
    href: "/enterprise",
  },
} as const

export const enterpriseWebsitesCapabilities = [
  {
    title: "UX and journey architecture",
    body: "Map how prospects, clients, partners and internal audiences actually move through information, enquiries and services, then design the experience around those journeys rather than a page inventory.",
    points: [
      "Audience and journey mapping before wireframes lock in",
      "Information architecture for multi-service and multi-site organisations",
      "Conversion and enquiry paths that match how decisions are made",
      "Accessibility and clarity treated as delivery requirements, not polish",
    ],
  },
  {
    title: "Corporate website engineering",
    body: "Build and harden the public digital presence as a maintainable product: content models, performance, security posture, environments and handover that operations can own.",
    points: [
      "Content structures that editorial and marketing teams can run",
      "Component systems suited to multi-brand or multi-division estates",
      "Environments, release control and rollback where the risk warrants it",
      "Clear ownership of code, hosting and documentation at handover",
    ],
  },
  {
    title: "Business process integration",
    body: "Connect the website to CRM, enquiry handling, portals, identity and operational tools so customer-facing journeys do not dump work into inboxes and spreadsheets.",
    points: [
      "Enquiry and lead capture wired to the systems teams already use",
      "Authentication and secure areas where public and private surfaces meet",
      "Workflow hand-offs that reduce duplicated data entry",
      "Integration boundaries documented for IT and procurement review",
    ],
  },
  {
    title: "Search and digital visibility",
    body: "Technical and content foundations that help the organisation be found for the services and locations that matter, without promising rankings or inventing performance figures.",
    points: [
      "Crawlable structure, metadata and internal linking as engineering work",
      "Service and location architecture suited to multi-offer organisations",
      "Measurement and reporting paths agreed with stakeholders",
      "Honest guidance on what SEO can and cannot guarantee",
    ],
  },
  {
    title: "Migration and operational continuity",
    body: "Move from legacy sites and fragmented estates without breaking search equity, content ownership or day-to-day operations.",
    points: [
      "Content and URL migration planned against real risk",
      "Redirect and cutover strategies with rollback options",
      "Parallel-run or staged release where continuity matters",
      "Support scope agreed before go-live, not improvised after",
    ],
  },
] as const

export const enterpriseWebsitesApproach = [
  {
    title: "Assess improve vs integrate vs rebuild",
    body: "We do not assume a greenfield rebuild. Discovery establishes whether the current estate can be evolved, connected, or needs replacement for a named set of constraints.",
  },
  {
    title: "Requirements before stack",
    body: "Technology choices follow journeys, integrations, security and operational ownership. We do not prescribe a single framework or hosting model before the problem is clear.",
  },
  {
    title: "Transparent scoping and milestones",
    body: "Written scope, acceptance criteria and explicit out-of-scope items precede committed build budget. Milestones are inspectable by commercial, marketing and IT stakeholders.",
  },
  {
    title: "Ownership and handover",
    body: "Clients retain ownership of deliverables agreed in the proposal. Documentation, environments and support boundaries are part of delivery, not an afterthought.",
  },
] as const

export const enterpriseWebsitesFounderAdvantage = [
  {
    title: "Direct access to the people who build",
    body: "You work with the founders accountable for architecture and delivery, not a relay of account managers translating between you and a distant delivery team.",
  },
  {
    title: "Less overhead, clearer accountability",
    body: "A small senior team means fewer hand-offs, fewer diluted decisions and a named owner when scope, risk or priority changes.",
  },
  {
    title: "Requirements-led engineering",
    body: "We challenge weak briefs early, including work that looks impressive but does not reduce operational friction or improve the customer journey.",
  },
  {
    title: "Transparent scoping and milestones",
    body: "Commercial and technical boundaries are written down. Changes are controlled rather than absorbed into vague day-rates.",
  },
  {
    title: "Ownership and handover",
    body: "Code, content models and operational documentation are delivered for the organisation to own, with support scope agreed separately.",
  },
  {
    title: "Capacity assessed before acceptance",
    body: "We assess complexity, third-party dependencies, specialist needs and support expectations before accepting work. Where extra resources are required, that is agreed during discovery rather than implied by a larger logo.",
  },
] as const

export const enterpriseWebsitesBuyerContext = {
  title: "Built for organisations with many journeys, not one brochure page.",
  body: "Typical buyers include multidisciplinary consultancies, professional services firms and multi-site operators whose public site must explain complex offers, route the right enquiry, and connect to internal systems without becoming a second operations team. We do not invent issues at named organisations; discovery starts from your constraints.",
} as const

export const enterpriseWebsitesSectionNav = [
  { id: "enterprise-websites-capabilities", label: "Capabilities" },
  { id: "enterprise-websites-approach", label: "Approach" },
  { id: "enterprise-websites-delivery", label: "Why ScaleSmiths" },
  { id: "enterprise-websites-proof", label: "Proof" },
  { id: "enterprise-websites-enquire", label: "Enquire" },
] as const

export const enterpriseWebsitesFaqs = [
  {
    q: "Is an enterprise website the same as a £2,000 website?",
    a: "No. Website design and development from £2,000 is a published starting point for agreed SME scopes. Corporate websites with complex journeys, integrations, multi-site structures, migrations or heightened security requirements are scoped independently after discovery and are not sold against that entry figure.",
  },
  {
    q: "How is this different from the Enterprise software page?",
    a: "/enterprise covers operational platforms, internal systems and complex software. /enterprise-websites covers corporate websites and digital experiences. Many organisations need both; discovery decides where the constraint actually sits.",
  },
  {
    q: "Will you prescribe a technology stack before discovery?",
    a: "No. We assess improve versus integrate versus rebuild first. Stack, hosting and integration choices follow requirements, risk and operational ownership.",
  },
  {
    q: "Can a two-founder company handle a larger digital transformation?",
    a: "We accept work only when complexity, dependencies, specialist needs and support expectations fit capacity. Extra resources, where required, are agreed during discovery. We do not invent team size, response-time SLAs or accreditations we do not hold.",
  },
  {
    q: "What proof can we inspect?",
    a: "Public case studies and platforms such as Prymal, VeteranFinder and The Business Circle demonstrate custom platforms, secure access, workflows, admin surfaces and production infrastructure. They are engineering proof points, not claims of named enterprise customer endorsements.",
  },
] as const

export function metadataForEnterpriseWebsitesPage(): Metadata {
  return buildPageMetadata({
    title: enterpriseWebsitesCopy.metaTitle,
    absoluteTitle: `${enterpriseWebsitesCopy.metaTitle} | ScaleSmiths`,
    description: enterpriseWebsitesCopy.metaDescription,
    path: ENTERPRISE_WEBSITES_PATH,
  })
}

export function buildEnterpriseWebsitesPageSchemas(siteUrl?: string) {
  const base = siteBaseUrl(siteUrl)
  const url = `${base}${ENTERPRISE_WEBSITES_PATH}`

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: enterpriseWebsitesCopy.metaTitle,
      description: enterpriseWebsitesCopy.metaDescription,
      url,
      isPartOf: { "@type": "WebSite", name: "ScaleSmiths", url: base },
      about: [
        "Enterprise website design",
        "Corporate digital experiences",
        "Website migration",
        "Customer journey architecture",
        "Business system integration",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Enterprise websites and digital experiences",
      serviceType: "Corporate website engineering and digital experience design",
      description: enterpriseWebsitesCopy.metaDescription,
      provider: organizationReference(base),
      areaServed: ["Nottingham", "Nottinghamshire", "United Kingdom"],
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: enterpriseWebsitesFaqs.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ]
}
