import type { Metadata } from "next"
import { buildPageMetadata } from "./page-metadata"
import { organizationReference, siteBaseUrl } from "./site-identity"
import { enquiryIntentHref } from "./enquiry-intents"

export const ENTERPRISE_PATH = "/enterprise"
export const ENTERPRISE_ENQUIRY_ANCHOR = "discuss"
export const ENTERPRISE_PROOF_SLUGS = [
  "veteranfinder",
  "prymal",
  "the-business-circle",
  "pinkys-prints",
] as const

export const enterprisePageCopy = {
  metaTitle: "Enterprise Software Development UK",
  metaDescription:
    "Founder-led enterprise software development in Nottingham and across the UK. Bespoke operational platforms, internal systems, workflow software, integrations and legacy replacement — designed around how your organisation actually operates.",
  eyebrow: "Enterprise systems",
  title: "Enterprise software built around how your organisation actually operates.",
  lede:
    "ScaleSmiths designs and builds bespoke platforms for organisations that have outgrown fragmented software, duplicated workflows, spreadsheets, disconnected SaaS products and manual operational processes. Small, senior and founder-led — with direct access to the people who architect and deliver the system.",
  primaryCta: {
    label: "Discuss an Enterprise System",
    href: `${ENTERPRISE_PATH}#${ENTERPRISE_ENQUIRY_ANCHOR}`,
  },
  secondaryCta: {
    label: "View Technical Work",
    href: "/work",
  },
  enquiryCta: {
    label: "Start an Enterprise Enquiry",
    href: enquiryIntentHref("enterprise"),
  },
} as const

export const enterpriseProblems = [
  {
    title: "Fragmented systems",
    body: "Critical work is split across tools that were never designed to operate as one estate.",
  },
  {
    title: "Duplicated data entry",
    body: "Teams re-key the same information into multiple systems, creating delay, cost and inconsistency.",
  },
  {
    title: "Legacy workflows",
    body: "Processes that once worked locally now create bottlenecks as volume, sites or regulations grow.",
  },
  {
    title: "Manual compliance",
    body: "Evidence, sign-off and audit trails live in documents and inboxes instead of controlled system behaviour.",
  },
  {
    title: "Overlapping products",
    body: "Multiple SaaS products partially cover the same job, with none owning the end-to-end operating model.",
  },
  {
    title: "Tools that no longer scale",
    body: "Internal applications, spreadsheets and brittle scripts struggle under multi-team or multi-site demand.",
  },
  {
    title: "Complex permissions",
    body: "Access rules need to reflect roles, sites, contractors and sensitive operational boundaries.",
  },
  {
    title: "Multi-site operations",
    body: "Local teams need practical tools while leadership still needs coherent visibility and control.",
  },
  {
    title: "Audit-heavy environments",
    body: "Operations Directors, Quality and H&S need reliable records of who did what, when and why.",
  },
  {
    title: "Integration-heavy estates",
    body: "ERP, CRM, identity, finance and operational systems must exchange data without fragile manual bridges.",
  },
  {
    title: "Offline and mobile work",
    body: "Field, warehouse and site teams need systems that remain useful when connectivity is imperfect.",
  },
] as const

export const enterpriseSystemTypes = [
  {
    title: "Custom operational platforms",
    body: "Systems that encode how your organisation actually runs — not a generic template forced over the top.",
  },
  {
    title: "Internal business systems",
    body: "Back-office and staff-facing applications for request handling, approvals, scheduling and operational control.",
  },
  {
    title: "Workflow engines",
    body: "Structured process flows with clear ownership, states, escalation and measurable hand-offs.",
  },
  {
    title: "Inspection and check systems",
    body: "Digital checks, evidence capture and sign-off designed for field and site operational reality.",
  },
  {
    title: "Compliance platforms",
    body: "Architected to support controlled recording, review and retention requirements defined with your stakeholders.",
  },
  {
    title: "Asset and inventory systems",
    body: "Tracking, status, location and lifecycle visibility for equipment, stock or distributed operational assets.",
  },
  {
    title: "Portals and partner access",
    body: "Role-aware portals for staff, clients, suppliers or franchise partners with controlled information boundaries.",
  },
  {
    title: "SaaS products",
    body: "Multi-tenant product foundations where commercial software itself is the operating system being built.",
  },
] as const

export const enterpriseCapabilities = [
  "Custom operational platforms",
  "Internal business systems",
  "Workflow engines",
  "Mobile applications",
  "Offline-first applications",
  "Dashboards and reporting",
  "Inspection and check systems",
  "Compliance platforms",
  "Asset systems",
  "Portals",
  "SaaS foundations",
  "APIs",
  "Enterprise integrations",
  "Identity and SSO",
  "RBAC / ABAC",
  "Audit trails",
  "Data migration",
  "Cloud infrastructure",
  "Observability",
  "Disaster recovery planning",
  "CI/CD",
  "Testing and validation",
] as const

export const enterpriseSecurity = [
  {
    title: "Access control",
    body: "Built with role-based and, where needed, attribute-based access models that reflect organisational reality.",
  },
  {
    title: "Auditability",
    body: "Designed to support audit trails for sensitive actions, changes and operational evidence — subject to the agreed scope.",
  },
  {
    title: "Secure delivery posture",
    body: "Architecture, secret handling, environment separation and review practices are planned with the application, not after it.",
  },
  {
    title: "Client governance",
    body: "Work proceeds subject to client security, procurement, legal and information-governance requirements. We do not claim certifications or regulatory approvals we do not hold.",
  },
] as const

export const enterpriseIntegrations = [
  {
    title: "Identity and SSO",
    body: "Can integrate with enterprise identity providers and SSO flows where the client estate requires centralised authentication.",
  },
  {
    title: "Operational systems",
    body: "APIs and controlled sync patterns for CRM, ERP, finance, HR and other line-of-business platforms.",
  },
  {
    title: "Event and data exchange",
    body: "Reliable inbound and outbound interfaces designed around ownership, retries, validation and observability.",
  },
  {
    title: "Migration paths",
    body: "Phased cutovers from spreadsheets, legacy applications or overlapping SaaS products with explicit data mapping.",
  },
] as const

export const enterpriseMultiSite = [
  {
    title: "Site and team structure",
    body: "Models that respect local operating units while preserving organisation-wide consistency.",
  },
  {
    title: "Permissions by context",
    body: "Access that can vary by role, site, function or contractor relationship without proliferating one-off exceptions.",
  },
  {
    title: "Local action, central visibility",
    body: "Field and site teams get tools that fit the work; leadership gets coherent reporting and operational signal.",
  },
  {
    title: "Shared standards",
    body: "Common process definitions where standardisation matters, with controlled variation where local reality demands it.",
  },
] as const

export const enterpriseProcess = [
  {
    title: "Discovery",
    body: "Map the operating model, pain points, constraints, integrations, compliance expectations and success criteria with the people who live the work.",
  },
  {
    title: "Architecture",
    body: "Define system boundaries, data ownership, identity, permissions, audit needs and the first dependable release.",
  },
  {
    title: "Build and validate",
    body: "Engineer against the agreed model with testing, migration rehearsal and operational readiness checks appropriate to the risk.",
  },
  {
    title: "Deploy and harden",
    body: "Controlled release, monitoring, support paths and a roadmap for the next increments — not an open-ended rewrite.",
  },
] as const

export const enterpriseFounderAdvantage = [
  {
    title: "Direct access to builders",
    body: "You work with the founders and senior engineers responsible for architecture and delivery — not a relay of account managers.",
  },
  {
    title: "Technically deep, commercially grounded",
    body: "We challenge weak assumptions early, including scope that looks impressive but does not reduce operational risk.",
  },
  {
    title: "Senior attention throughout",
    body: "The people who model the system stay accountable through design, build, release and improvement.",
  },
  {
    title: "Right-sized for complex work",
    body: "Small enough to move with clarity; senior enough to undertake complex internal platforms without enterprise-theatre overhead.",
  },
] as const

export const enterpriseProofIntro =
  "Selected ScaleSmiths technical work showing platform, SaaS, integration and operational-system depth. These are engineering proof points — not claims of named enterprise customer endorsements or guaranteed regulatory outcomes."

export const enterpriseFaqs = [
  {
    q: "Is ScaleSmiths an enterprise consultancy?",
    a: "No. ScaleSmiths is a founder-led software engineering company. We undertake complex internal platforms and operational systems with senior technical involvement throughout, without the overhead or positioning of a giant consultancy.",
  },
  {
    q: "What kinds of enterprise systems do you build?",
    a: "Custom operational platforms, internal business systems, workflow engines, portals, compliance-oriented applications, asset systems, mobile and offline-first tools, SaaS foundations, APIs and enterprise integrations — scoped around the organisation's actual operating model.",
  },
  {
    q: "Do you hold ISO 27001 or Cyber Essentials certification?",
    a: "We do not claim certifications we do not currently hold. Security and governance are designed into architecture and delivery, and engagements proceed subject to client security and procurement requirements.",
  },
  {
    q: "How does an enterprise engagement usually start?",
    a: "With a focused discovery conversation covering operating constraints, integrations, permissions, audit needs and the first dependable release. From there we propose architecture and a staged delivery plan rather than an unbounded transformation programme.",
  },
] as const

export function metadataForEnterprisePage(): Metadata {
  return buildPageMetadata({
    title: enterprisePageCopy.metaTitle,
    absoluteTitle: `${enterprisePageCopy.metaTitle} | ScaleSmiths`,
    description: enterprisePageCopy.metaDescription,
    path: ENTERPRISE_PATH,
  })
}

export function buildEnterprisePageSchemas(siteUrl?: string) {
  const base = siteBaseUrl(siteUrl)
  const url = `${base}${ENTERPRISE_PATH}`

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: enterprisePageCopy.metaTitle,
      description: enterprisePageCopy.metaDescription,
      url,
      isPartOf: { "@type": "WebSite", name: "ScaleSmiths", url: base },
      about: [
        "Enterprise software development UK",
        "Bespoke enterprise software",
        "Custom business systems",
        "Internal software development",
        "Operational software",
        "Enterprise workflow software",
        "Legacy software replacement",
        "Systems integration",
        "Nottingham enterprise software development",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Enterprise software development",
      serviceType: "Bespoke enterprise and operational software engineering",
      description: enterprisePageCopy.metaDescription,
      provider: organizationReference(base),
      areaServed: ["Nottingham", "Nottinghamshire", "United Kingdom"],
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: enterpriseFaqs.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ]
}
