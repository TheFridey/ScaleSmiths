import type { Metadata } from "next"
import { enquiryIntentHref } from "./enquiry-intents"
import { buildPageMetadata } from "./page-metadata"
import { CONTACT_EMAIL, organizationReference, siteBaseUrl } from "./site-identity"

export const SECURITY_PATH = "/security"
export const SECURITY_CONTACT_ANCHOR = "security-contact"

export const securityPageCopy = {
  metaTitle: "Security & Trust | Secure Software Development UK",
  metaDescription:
    "How ScaleSmiths approaches secure software development, enterprise software security, infrastructure, data protection and operational resilience — designed into architecture and delivery, without unverified certification claims.",
  eyebrow: "Security & trust",
  title: "Security designed into the architecture — not bolted on at the end.",
  lede:
    "ScaleSmiths designs security into the architecture and delivery process rather than treating it as a final checklist. This page explains how we approach identity, application security, data protection, infrastructure, resilience and secure delivery for custom and enterprise software — in language that IT, security and procurement can inspect.",
  primaryCta: {
    label: "Discuss security requirements",
    href: `${SECURITY_PATH}#${SECURITY_CONTACT_ANCHOR}`,
  },
  secondaryCta: {
    label: "Enterprise systems",
    href: "/enterprise",
  },
  enquiryCta: {
    label: "Start an Enterprise Enquiry",
    href: enquiryIntentHref("enterprise"),
  },
  securityEmailHref: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Security enquiry — ScaleSmiths")}`,
} as const

export const securityPhilosophy = [
  {
    title: "Architecture first",
    body: "Auth boundaries, tenancy, privileged actions, data classification and failure modes are modelled before delivery expands — not discovered in a late review.",
  },
  {
    title: "Least privilege by default",
    body: "Access for people, services and integrations is scoped to what the operating model requires, with elevation treated as an explicit design decision.",
  },
  {
    title: "Evidence over slogans",
    body: "We describe controls that are designed, built and operated — and we do not imply certifications, regulatory approval or guaranteed compliance we do not hold.",
  },
  {
    title: "Client governance respected",
    body: "Engagements proceed subject to client security, procurement, legal and information-governance requirements. Client-specific controls can be reviewed before development.",
  },
] as const

export const securitySections = [
  {
    id: "identity-access",
    eyebrow: "Identity and access control",
    title: "Know who is acting — and what they may do.",
    lede: "Identity is treated as a first-class system boundary, not a login screen.",
    items: [
      { title: "RBAC and ABAC", body: "Role-based access is the baseline. Attribute-based rules can be introduced where site, team, contractor or data sensitivity requires finer control." },
      { title: "SSO, OIDC and SAML", body: "Systems can integrate with corporate identity providers using OIDC or SAML where the client estate requires centralised authentication." },
      { title: "MFA and session handling", body: "Multi-factor authentication and secure session handling are designed where the risk and platform support them — including idle timeouts, rotation and revocation paths." },
      { title: "Least privilege", body: "Human and machine identities are scoped to the minimum permissions needed for the agreed operating model." },
    ],
  },
  {
    id: "application-security",
    eyebrow: "Application security",
    title: "Defend the software surface, not just the perimeter.",
    lede: "Application controls are part of the build: validation, headers, abuse resistance and safe defaults.",
    items: [
      { title: "Input validation", body: "Server-side validation and typed contracts reduce injection and inconsistent state before data reaches core workflows." },
      { title: "Security headers and CSP", body: "Content Security Policy and related security headers are configured as part of delivery, proportionate to the application model." },
      { title: "Rate limiting", body: "Sensitive and public endpoints can be rate-limited to reduce brute-force, scraping and abuse pressure." },
      { title: "TLS in transit", body: "Public and service traffic is designed to use TLS. Internal service communication follows the hosting model agreed for the engagement." },
    ],
  },
  {
    id: "data-protection",
    eyebrow: "Data protection",
    title: "Protect data according to sensitivity and ownership.",
    lede: "Data protection is scoped with the controller/processor relationship and the actual data classes in the system.",
    items: [
      { title: "Encryption in transit", body: "TLS is used for public endpoints and other channels where the platform and architecture support encrypted transport." },
      { title: "Encryption at rest", body: "Encryption at rest is used where the hosting platform and storage services support it for the agreed infrastructure." },
      { title: "Data minimisation", body: "Collections and retention are designed around the business purpose — not indefinite accumulation by default." },
      { title: "Access boundaries", body: "Application permissions, environment separation and operational access paths are designed to limit who can reach sensitive records." },
    ],
  },
  {
    id: "infrastructure-security",
    eyebrow: "Infrastructure security",
    title: "Separate environments. Control production change.",
    lede: "Infrastructure choices are part of the security model, not an afterthought once the application works locally.",
    items: [
      { title: "Environment separation", body: "Development, staging and production are separated so experimental work does not share production credentials or data by default." },
      { title: "Protected production deployments", body: "Production releases are designed around controlled CI/CD paths, review and explicit promotion rather than ad-hoc manual drift." },
      { title: "Infrastructure as code", body: "Where infrastructure is part of the engagement, configuration is preferred as code so changes are reviewable and repeatable." },
      { title: "Network and host posture", body: "Exposure is kept intentional: only required services are public; administrative surfaces stay constrained." },
    ],
  },
  {
    id: "secrets-management",
    eyebrow: "Secrets management",
    title: "Secrets stay out of source control and client bundles.",
    lede: "Provider keys, auth secrets and encryption material are handled as operational assets.",
    items: [
      { title: "Environment-scoped secrets", body: "Secrets are injected through environment or secret stores appropriate to the hosting model — not committed to repositories." },
      { title: "No public exposure", body: "Provider credentials remain server-only. Public clients do not receive privileged keys through NEXT_PUBLIC or equivalent channels." },
      { title: "Rotation readiness", body: "Secret rotation and replacement paths are considered during design so compromise response is not inventing process under pressure." },
      { title: "Least operational access", body: "Access to production secrets is limited to the people and systems that need it for delivery and support." },
    ],
  },
  {
    id: "logging-auditability",
    eyebrow: "Logging and auditability",
    title: "Make important actions reconstructable.",
    lede: "Logging supports operations and investigation. Audit trails support accountability where the domain requires them.",
    items: [
      { title: "Structured logging", body: "Application and infrastructure logs are structured where practical so incidents can be investigated without guesswork." },
      { title: "Security-relevant events", body: "Authentication failures, privileged actions and unusual operational signals are candidates for elevated visibility." },
      { title: "Audit trails", body: "Systems can be designed with immutable or append-oriented audit trails where the operating model or client governance requires them." },
      { title: "Proportionate retention", body: "Retention is agreed against operational need, legal obligations and client policy — not infinite storage by default." },
    ],
  },
] as const

export const securityLifecycle = [
  {
    title: "Secure development lifecycle",
    body: "Threat-relevant design reviews, authenticated workflows, migration safety and security checks travel with delivery rather than appearing only at release.",
  },
  {
    title: "Dependency and vulnerability management",
    body: "Dependencies are pinned where governance requires it, reviewed for material risk, and updated through controlled paths. Dependency scanning informs remediation priority.",
  },
  {
    title: "Testing",
    body: "Automated tests, validation suites and, where proportionate, SAST tooling support delivery. DAST or broader dynamic testing can be scoped when the risk justifies it.",
  },
  {
    title: "Third-party penetration testing",
    body: "Independent penetration testing can be supported through appropriate third parties when client policy or risk requires it. ScaleSmiths does not treat a marketing badge as a substitute for scoped testing.",
  },
] as const

export const securityResilience = [
  {
    title: "Backups and recovery",
    body: "Database backups are part of production design. Point-in-time recovery is used where the database platform supports it and the engagement requires that recovery objective.",
  },
  {
    title: "Disaster recovery planning",
    body: "Recovery expectations are discussed as design constraints — RPO/RTO aspirations, failover shape and restore rehearsal — rather than assumed from hosting defaults alone.",
  },
  {
    title: "Monitoring and observability",
    body: "Health checks, error reporting, performance signals and operational dashboards are designed so failures are visible before users have to report them.",
  },
  {
    title: "Incident response approach",
    body: "Incidents are handled with containment, investigation, communication and remediation. Personal-data incidents follow the contractual and legal notification duties that apply to the engagement.",
  },
] as const

export const securityHosting = [
  {
    title: "Data hosting and residency",
    body: "Hosting region and residency constraints can be aligned to client-selected regions where the chosen cloud or hosting platform supports them. Residency is an explicit design choice, not an implied property of “being in the cloud”.",
  },
  {
    title: "Client cloud environments",
    body: "ScaleSmiths can work within client-controlled cloud accounts or projects when access, IAM boundaries and operational ownership are agreed up front.",
  },
  {
    title: "Third parties and subprocessors",
    body: "Hosting, email, analytics, error reporting and other subprocessors are selected and disclosed according to the service model. Changes that affect personal-data processing follow the contractual notice process.",
  },
  {
    title: "Client-specific security requirements",
    body: "Security questionnaires, architecture reviews, approved tooling lists and procurement controls can be reviewed before development so delivery is not inventing answers after the fact.",
  },
] as const

export const securityAssurance = {
  title: "Certifications and assurance",
  intro:
    "ScaleSmiths is actively strengthening its formal security assurance programme as the company expands into larger software engagements.",
  held:
    "ScaleSmiths does not currently claim ISO 27001, Cyber Essentials or Cyber Essentials Plus certification. We will not list certifications we do not hold.",
  planned:
    "Formal assurance routes such as Cyber Essentials, Cyber Essentials Plus and ISO 27001 are under consideration as part of that programme. Until held and verified, they are described only as planned or under consideration.",
  boundary:
    "Technical controls described on this page do not by themselves constitute regulatory compliance, sector accreditation or a guarantee of residual risk elimination.",
} as const

export const securityFaqs = [
  {
    q: "Can ScaleSmiths work within client cloud environments?",
    a: "Yes. Where access, identity boundaries and operational ownership are agreed, delivery can proceed inside client-controlled cloud accounts or projects rather than only in ScaleSmiths-operated infrastructure.",
  },
  {
    q: "Can systems use corporate SSO?",
    a: "Yes. Systems can be designed to integrate with corporate identity providers, including OIDC and SAML-based SSO, subject to the client's identity platform and procurement constraints.",
  },
  {
    q: "Can data remain in a client-selected region?",
    a: "Where the hosting platform supports the requested region, data residency can be designed around a client-selected location. Region choice should be confirmed during discovery, not assumed later.",
  },
  {
    q: "Can security requirements be reviewed before development?",
    a: "Yes. Security questionnaires, architecture expectations, approved tooling and control requirements can be reviewed before build so they shape the design rather than arriving as a late checklist.",
  },
  {
    q: "Do you support penetration testing?",
    a: "Yes. Independent penetration testing through appropriate third parties can be supported when client policy or risk requires it. Scope, timing and remediation ownership should be agreed in advance.",
  },
  {
    q: "How are production secrets handled?",
    a: "Production secrets are kept out of source control and public clients, injected through environment or secret stores appropriate to the hosting model, and access-limited to the people and systems that need them.",
  },
  {
    q: "Can clients receive architecture/security documentation?",
    a: "Yes. Proportionate architecture and security documentation can be provided for the engagement — for example system boundaries, auth model, data flows, environments and operational controls — subject to the agreed scope.",
  },
  {
    q: "How are backups handled?",
    a: "Database backups are designed into production operations. Point-in-time recovery is used where the platform supports it and the engagement requires that recovery capability. Backups reduce risk; they do not make loss impossible.",
  },
  {
    q: "Can systems support audit trails?",
    a: "Yes. Systems can be architected with structured logging and, where required, append-oriented or immutable audit trails for sensitive actions and operational evidence.",
  },
] as const

export function metadataForSecurityPage(): Metadata {
  return buildPageMetadata({
    title: "Security & Trust",
    absoluteTitle: securityPageCopy.metaTitle,
    description: securityPageCopy.metaDescription,
    path: SECURITY_PATH,
  })
}

export function buildSecurityPageSchemas(siteUrl?: string) {
  const base = siteBaseUrl(siteUrl)
  const url = `${base}${SECURITY_PATH}`

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: securityPageCopy.metaTitle,
      description: securityPageCopy.metaDescription,
      url,
      isPartOf: { "@type": "WebSite", name: "ScaleSmiths", url: base },
      about: [
        "Secure software development UK",
        "Enterprise software security",
        "Secure custom software development",
        "Software development security practices",
      ],
      publisher: organizationReference(base),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: securityFaqs.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ]
}
