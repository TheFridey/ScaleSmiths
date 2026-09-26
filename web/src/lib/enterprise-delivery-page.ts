import type { Metadata } from "next"
import { enquiryIntentHref } from "./enquiry-intents"
import { buildPageMetadata } from "./page-metadata"
import { organizationReference, siteBaseUrl } from "./site-identity"

export const ENTERPRISE_DELIVERY_PATH = "/enterprise/delivery"
export const ENTERPRISE_DELIVERY_CTA_ANCHOR = "start-discovery"

export const enterpriseDeliveryCopy = {
  metaTitle: "Enterprise Software Delivery Process | ScaleSmiths",
  metaDescription:
    "How ScaleSmiths handles complex software engagements from discovery through production rollout — founder-led engineering with structured enterprise delivery, staged risk reduction and clear change control.",
  eyebrow: "Enterprise delivery",
  title: "Founder-led engineering with structured enterprise delivery.",
  lede:
    "ScaleSmiths does not start coding from a vague brief. Complex engagements move through discovery, architecture, validated scope and controlled release — so Operations, IT, security and procurement can see how risk is reduced before production.",
  primaryCta: {
    label: "Start with Discovery",
    href: `${ENTERPRISE_DELIVERY_PATH}#${ENTERPRISE_DELIVERY_CTA_ANCHOR}`,
  },
  secondaryCta: {
    label: "Discuss Your Existing Systems",
    href: enquiryIntentHref("enterprise"),
  },
  enquiryCta: {
    label: "Start with Discovery",
    href: enquiryIntentHref("enterprise"),
  },
} as const

/** Compact staged methodology shown as the premium visual timeline. */
export const deliveryStages = [
  { id: "discovery", label: "Discovery", summary: "Map the real operating model before software is proposed." },
  { id: "prototype", label: "Prototype", summary: "Prove the highest-risk assumptions with a focused proof of concept." },
  { id: "validated-scope", label: "Validated Scope", summary: "Lock the first dependable release against evidence, not optimism." },
  { id: "mvp", label: "MVP", summary: "Build the smallest production-worthy system that removes the constraint." },
  { id: "uat", label: "UAT", summary: "Client acceptance and stakeholder review before go-live." },
  { id: "production", label: "Production", summary: "Controlled rollout with monitoring, rollback and support paths." },
  { id: "expansion", label: "Expansion", summary: "Add modules and capability only after the core system is dependable." },
] as const

export const deliveryPhases = [
  {
    title: "Discovery",
    body: "Establish what the organisation actually needs before architecture or build begins.",
  },
  {
    title: "Workflow mapping",
    body: "Document how work moves today — including hand-offs, exceptions and the spreadsheets people rely on.",
  },
  {
    title: "Requirements definition",
    body: "Translate operating reality into requirements, acceptance criteria and prioritised scope.",
  },
  {
    title: "Technical architecture",
    body: "Select the system shape that fits the environment, constraints and first dependable release.",
  },
  {
    title: "Security review",
    body: "Test identity, data, secrets, environments and audit assumptions against client security expectations.",
  },
  {
    title: "Prototype / proof of concept",
    body: "Exercise the highest-risk technical or workflow assumptions before full implementation.",
  },
  {
    title: "MVP definition",
    body: "Separate the first production release from later expansion so delivery risk stays visible.",
  },
  {
    title: "Implementation",
    body: "Build against the agreed model with environment separation, CI/CD and review discipline.",
  },
  {
    title: "Testing and validation",
    body: "Prove behaviour with automated and risk-proportionate manual checks before stakeholders accept the system.",
  },
  {
    title: "UAT",
    body: "Client and stakeholder acceptance against agreed criteria prior to production rollout.",
  },
  {
    title: "Migration",
    body: "Plan and rehearse data and process cutover so go-live is not the first time migration is attempted.",
  },
  {
    title: "Rollout",
    body: "Release through protected production deployment with rollback capability and clear ownership.",
  },
  {
    title: "Monitoring",
    body: "Make health, errors and operational signals visible so issues are found before users have to report them.",
  },
  {
    title: "Support and continuous improvement",
    body: "Maintain, support and enhance the system under explicit commercial boundaries — not unlimited development.",
  },
] as const

export const discoveryTopics = [
  "Users and actors",
  "Roles and permissions",
  "Current systems",
  "Pain points",
  "Duplicate workflows",
  "Data ownership and quality",
  "Integrations",
  "Operational risks",
  "Existing security requirements",
  "Reporting needs",
  "Migration constraints",
  "Approval processes",
  "Deployment requirements",
] as const

export const requirementsOutputs = [
  { title: "Requirements documentation", body: "A written account of what the system must do, for whom, and under which constraints." },
  { title: "Acceptance criteria", body: "Testable conditions that define when a requirement is met — used in UAT and release decisions." },
  { title: "User journeys", body: "End-to-end paths for the people who will actually operate the system." },
  { title: "System architecture", body: "Boundaries, components and responsibilities for the first dependable release." },
  { title: "Data model", body: "Entities, ownership, relationships and integrity rules that the workflows depend on." },
  { title: "Integration map", body: "Systems, directions of data flow, failure handling and ownership of each interface." },
  { title: "Security assumptions", body: "Identity, access, audit, secrets and environment expectations that shape the build." },
  { title: "Delivery roadmap", body: "Staged plan from discovery through MVP, UAT, production and later expansion." },
  { title: "Risk register", body: "Visible delivery, technical, migration and operational risks with owners and mitigations." },
] as const

export const architectureDomains = [
  { title: "Web", body: "Browser applications and admin surfaces for staff, partners or customers." },
  { title: "Mobile", body: "Mobile experiences where field or on-site work needs a purpose-built interface." },
  { title: "Offline", body: "Offline-first patterns when connectivity cannot be assumed." },
  { title: "APIs", body: "Stable interfaces for integrations, partners and internal services." },
  { title: "Databases", body: "Data stores chosen for consistency, auditability and operational ownership." },
  { title: "Queues", body: "Asynchronous processing where work must survive load, retries and partial failure." },
  { title: "Object storage", body: "Files, evidence and media handled outside the primary transactional store." },
  { title: "Cloud", body: "Hosting shaped around the client estate, residency and operational model." },
  { title: "Identity", body: "SSO, OIDC/SAML, MFA and session handling where the risk requires them." },
  { title: "Integrations", body: "Controlled connections to ERP, CRM, finance and other line-of-business systems." },
  { title: "Observability", body: "Logging, metrics and health signals designed with the application." },
] as const

export const stagedDeliveryReasons = [
  {
    title: "Assumptions are tested early",
    body: "Discovery and prototype expose the expensive unknowns before full implementation commits budget.",
  },
  {
    title: "Scope stays inspectable",
    body: "Validated scope and MVP definition make the first release a decision, not an open-ended rewrite.",
  },
  {
    title: "Stakeholders accept before go-live",
    body: "UAT creates a deliberate acceptance gate so production is not the first serious review.",
  },
  {
    title: "Expansion follows evidence",
    body: "Further modules are planned after the core system is dependable — reducing the chance of building the wrong second phase.",
  },
] as const

export const testingTypes = [
  { title: "Unit testing", body: "Verifies discrete logic and domain rules in isolation." },
  { title: "Integration testing", body: "Checks how application boundaries, databases and services interact." },
  { title: "E2E testing", body: "Exercises critical user journeys through the running system." },
  { title: "Permission testing", body: "Confirms roles and attributes grant and deny access as designed." },
  { title: "Migration testing", body: "Rehearses data cutover, mapping and rollback paths before production." },
  { title: "Performance testing", body: "Validates behaviour under representative load where the risk requires it." },
  { title: "Security testing", body: "Covers application controls and, where required, third-party penetration testing." },
  { title: "Backup / recovery testing", body: "Confirms restore capability where recovery objectives matter to the engagement." },
] as const

export const uatPoints = [
  {
    title: "Acceptance against criteria",
    body: "UAT is run against the agreed acceptance criteria — not against an informal “does it look right?” review alone.",
  },
  {
    title: "Stakeholder review",
    body: "The people who own the process, data or risk review the system before production rollout.",
  },
  {
    title: "Issue triage",
    body: "Findings are classified as release blockers, deferred work or scope change — so go-live is a controlled decision.",
  },
] as const

export const changeControlPoints = [
  {
    title: "Documented change",
    body: "Significant changes after agreed scope are written down — including why they matter and what they affect.",
  },
  {
    title: "Impact assessment",
    body: "Architecture, security, migration, timeline and commercial impact are assessed before work is re-planned.",
  },
  {
    title: "Estimated, not absorbed",
    body: "Material new work is estimated and agreed. It is not silently folded into the original delivery commitment.",
  },
] as const

export const releaseManagementPoints = [
  {
    title: "Versioned releases",
    body: "Production changes are released as identifiable versions so what is live can be reconstructed.",
  },
  {
    title: "Protected production deployment",
    body: "Production is reached through controlled promotion paths rather than ad-hoc manual drift.",
  },
  {
    title: "Rollback capability",
    body: "Release design includes a path back when a deploy does not behave as expected.",
  },
  {
    title: "Environment separation",
    body: "Development, staging and production remain separated so experimental work does not share production credentials or data by default.",
  },
] as const

export const documentationOutputs = [
  "Architecture documentation",
  "Deployment documentation",
  "Integration documentation",
  "Operating procedures",
  "Admin / user guidance",
  "Support handover",
] as const

export const supportModels = [
  {
    title: "Maintenance",
    body: "Keeping the agreed system healthy: updates, monitoring, dependency care and defect remediation within the supported boundary.",
  },
  {
    title: "Managed support",
    body: "An accountable support relationship with agreed response expectations, access paths and operational ownership.",
  },
  {
    title: "Enhancements",
    body: "Scoped improvements to the live system — prioritised, estimated and delivered as discrete work, not as unlimited backlog burning.",
  },
  {
    title: "New modules / projects",
    body: "Larger expansions return to discovery and validated scope. Support does not imply unlimited development capacity.",
  },
] as const

export const enterpriseDeliveryFaqs = [
  {
    q: "Do you start building from a short brief?",
    a: "No. Complex engagements begin with discovery and workflow mapping so requirements, architecture and risk are visible before implementation expands.",
  },
  {
    q: "Why use staged delivery?",
    a: "Staged delivery — Discovery → Prototype → Validated Scope → MVP → UAT → Production → Expansion — reduces the chance of committing full build budget against untested assumptions.",
  },
  {
    q: "What happens if requirements change after scope is agreed?",
    a: "Significant changes are documented, assessed and estimated. Material new work is not silently absorbed into the original commitment.",
  },
  {
    q: "Is support the same as ongoing development?",
    a: "No. Maintenance and managed support keep the agreed system operating. Enhancements and new modules are scoped separately and do not imply unlimited development.",
  },
] as const

export function metadataForEnterpriseDeliveryPage(): Metadata {
  return buildPageMetadata({
    title: "Enterprise Delivery Process",
    absoluteTitle: enterpriseDeliveryCopy.metaTitle,
    description: enterpriseDeliveryCopy.metaDescription,
    path: ENTERPRISE_DELIVERY_PATH,
  })
}

export function buildEnterpriseDeliveryPageSchemas(siteUrl?: string) {
  const base = siteBaseUrl(siteUrl)
  const url = `${base}${ENTERPRISE_DELIVERY_PATH}`

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: enterpriseDeliveryCopy.metaTitle,
      description: enterpriseDeliveryCopy.metaDescription,
      url,
      isPartOf: { "@type": "WebSite", name: "ScaleSmiths", url: base },
      about: [
        "Enterprise software delivery",
        "Software discovery process",
        "Staged software delivery",
        "Enterprise UAT and rollout",
      ],
      publisher: organizationReference(base),
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "ScaleSmiths enterprise software delivery process",
      description: enterpriseDeliveryCopy.metaDescription,
      url,
      step: deliveryStages.map((stage, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: stage.label,
        text: stage.summary,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: enterpriseDeliveryFaqs.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ]
}
