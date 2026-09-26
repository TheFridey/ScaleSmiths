/**
 * Reusable enterprise architecture framework copy.
 * Mounted on /enterprise, /custom-systems, and available for work/case-study pages.
 * Keep claims operational and generic — never name private client brands here.
 */

export interface ArchitectureCapability {
  name: string
  why: string
}

export interface ArchitectureCapabilityGroup {
  id: string
  title: string
  intro: string
  capabilities: readonly ArchitectureCapability[]
}

export const architectureFrameworkCopy = {
  eyebrow: "Technical architecture",
  title: "Architecture follows the problem.",
  lede:
    "ScaleSmiths does not force every project into one preset stack. Identity, data, integrations and hosting are selected around the operating environment, security constraints and the first dependable release — so the system can be owned, operated and extended with discipline.",
  diagramTitle: "Typical enterprise architecture",
  diagramIntro:
    "A generic reference shape for serious operational systems. Exact components change with the problem; the layering and boundaries stay deliberate.",
  deploymentTitle: "Where systems can run",
  deploymentIntro:
    "Deployment topology is a design decision, subject to project and security requirements — not a one-size hosting assumption.",
} as const

export const architectureDeploymentOptions = [
  {
    title: "ScaleSmiths-managed infrastructure",
    body: "Hosted and operated in environments ScaleSmiths manages, with agreed environment separation, secrets handling and operational ownership.",
  },
  {
    title: "Client-controlled cloud environments",
    body: "Built inside the client's own cloud accounts or projects when IAM boundaries, access and operational ownership are agreed up front.",
  },
  {
    title: "Approved Azure / AWS environments",
    body: "Aligned to an organisation's approved cloud estate and regional constraints where the platform and security policy require it.",
  },
  {
    title: "Portable Docker-based deployments",
    body: "Containerised delivery where portability, repeatable promotion and controlled runtime packaging reduce environment drift.",
  },
] as const

/** Generic flow nodes for the reusable architecture diagram. */
export const architectureDiagramLayers = [
  { id: "users", label: "Users", detail: "Staff, partners, field teams, customers" },
  { id: "idp", label: "Identity Provider", detail: "SSO / OIDC / SAML / MFA" },
  { id: "apps", label: "Web / Mobile Application", detail: "Portals, offline-capable clients, admin surfaces" },
  { id: "api", label: "API Layer", detail: "Authenticated contracts and rate limits" },
  { id: "services", label: "Application Services", detail: "Workflow, domain logic, jobs" },
  { id: "data", label: "PostgreSQL / Redis / Object Storage", detail: "Transactional data, cache, files & evidence" },
  { id: "integrations", label: "Integrations", detail: "REST, webhooks, SFTP, Graph, legacy" },
  { id: "ops", label: "Monitoring / Audit / Reporting", detail: "Observability, evidence, operational signal" },
] as const

export const architectureCapabilityGroups: readonly ArchitectureCapabilityGroup[] = [
  {
    id: "identity",
    title: "Identity",
    intro: "Who can act in the system — and under which organisational constraints.",
    capabilities: [
      {
        name: "SSO",
        why: "Staff access the platform with existing corporate credentials, reducing password sprawl and simplifying joiner/leaver control.",
      },
      {
        name: "MFA",
        why: "Privileged and remote access can require a second factor where the risk and identity platform support it.",
      },
      {
        name: "OIDC",
        why: "Modern identity protocols let applications trust a central provider without inventing bespoke login schemes.",
      },
      {
        name: "SAML",
        why: "Enterprises that standardise on SAML can still federate access into custom operational platforms.",
      },
      {
        name: "RBAC",
        why: "Role-based permissions keep day-to-day access understandable for admins and auditable for security reviews.",
      },
      {
        name: "ABAC",
        why: "Attribute rules can restrict access by site, business unit, contractor status or data sensitivity when roles alone are too coarse.",
      },
      {
        name: "User provisioning",
        why: "Joiners, movers and leavers can be reflected in the application without brittle manual account hygiene.",
      },
    ],
  },
  {
    id: "applications",
    title: "Applications",
    intro: "The surfaces people and systems actually use to get work done.",
    capabilities: [
      {
        name: "Web",
        why: "Browser applications give staff and partners a controlled operational interface without distributing unmanaged desktop software.",
      },
      {
        name: "Mobile",
        why: "Field and on-site work needs interfaces that fit the job, not a desktop workflow squeezed onto a phone.",
      },
      {
        name: "Offline-first",
        why: "Warehouses, sites and vehicles often lose connectivity; work must continue and sync safely when the network returns.",
      },
      {
        name: "Internal tools",
        why: "Back-office systems encode approvals, exceptions and operational control instead of leaving them in spreadsheets.",
      },
      {
        name: "Portals",
        why: "Clients, suppliers or franchise partners get a role-aware window into the process without seeing the whole estate.",
      },
      {
        name: "APIs",
        why: "Stable contracts let other systems automate work without scraping screens or duplicating data entry.",
      },
      {
        name: "Realtime",
        why: "Live status, messaging or operational feeds keep multi-user processes coherent when delays create risk.",
      },
    ],
  },
  {
    id: "data",
    title: "Data",
    intro: "The models, storage and retention rules that make operations reliable and reviewable.",
    capabilities: [
      {
        name: "PostgreSQL",
        why: "A proven relational store for operational systems that need integrity, queryability and controlled transactions.",
      },
      {
        name: "Structured data models",
        why: "Explicit entities and relationships stop critical process state living only in someone's memory or inbox.",
      },
      {
        name: "Migrations",
        why: "Schema change is versioned and rehearsable so production evolution is deliberate rather than improvised.",
      },
      {
        name: "Retention",
        why: "Data kept only as long as the operating and legal purpose requires — reducing sprawl and review burden.",
      },
      {
        name: "Auditability",
        why: "Sensitive actions and changes can be reconstructed later for quality, security or operational investigation.",
      },
      {
        name: "Object storage",
        why: "Files, evidence and media sit outside the transactional database with clear ownership and access rules.",
      },
    ],
  },
  {
    id: "integration",
    title: "Integration",
    intro: "How the new system joins the estate without fragile manual bridges.",
    capabilities: [
      {
        name: "REST APIs",
        why: "Standard HTTP contracts make system-to-system exchange reviewable, testable and operable.",
      },
      {
        name: "Webhooks",
        why: "Event-driven updates reduce polling delay when another platform needs to react to a change.",
      },
      {
        name: "SFTP",
        why: "Batch and partner file exchanges remain common in operational estates and still need controlled handling.",
      },
      {
        name: "CSV / JSON",
        why: "Structured interchange formats support migrations, partner feeds and interim bridges while deeper APIs mature.",
      },
      {
        name: "Microsoft Graph",
        why: "Organisations on Microsoft 365 can connect identity, mail or directory workflows where the engagement requires it.",
      },
      {
        name: "Third-party platforms",
        why: "CRM, ERP, finance and specialist SaaS tools can exchange data without re-keying the same facts twice.",
      },
      {
        name: "Legacy systems",
        why: "Older platforms can be bounded and integrated so replacement happens in controlled stages, not a big-bang leap.",
      },
    ],
  },
  {
    id: "infrastructure",
    title: "Infrastructure",
    intro: "The runtime and delivery controls that keep production change intentional.",
    capabilities: [
      {
        name: "Docker",
        why: "Container packaging makes runtime dependencies explicit and promotion between environments more repeatable.",
      },
      {
        name: "Cloud environments",
        why: "Compute and managed services can follow the client's approved cloud estate and residency constraints.",
      },
      {
        name: "Infrastructure-as-code",
        why: "Environment configuration becomes reviewable and rebuildable instead of tribal knowledge on a server.",
      },
      {
        name: "CI/CD",
        why: "Automated checks and controlled promotion reduce the chance that production is updated by ad-hoc manual steps.",
      },
      {
        name: "Environment separation",
        why: "Development and staging stay apart from production credentials and data by default.",
      },
      {
        name: "Secrets management",
        why: "API keys and auth material stay out of source control and public clients, with access limited to need.",
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    intro: "How the system stays visible, recoverable and supportable after go-live.",
    capabilities: [
      {
        name: "Monitoring",
        why: "Health and error signals surface failure before users become the monitoring system.",
      },
      {
        name: "Structured logging",
        why: "Investigations need searchable, consistent events — not free-text noise that cannot be correlated.",
      },
      {
        name: "Backups",
        why: "Operational data needs a restore path that matches the organisation's recovery expectations.",
      },
      {
        name: "Rollback",
        why: "A release that misbehaves needs a deliberate path back, not an improvised hotfix under pressure.",
      },
      {
        name: "Disaster recovery planning",
        why: "RPO/RTO aspirations and restore shape are design constraints for critical systems, not afterthoughts.",
      },
      {
        name: "Support",
        why: "Live systems need clear ownership, access paths and response expectations once they become operationally critical.",
      },
      {
        name: "Incident response",
        why: "Containment, investigation and communication must be possible when something fails in production.",
      },
    ],
  },
] as const

export const architectureRelatedLinks = [
  { href: "/enterprise", label: "Enterprise systems", description: "Complex operational platforms and multi-site software." },
  { href: "/security", label: "Security & Trust", description: "Identity, data protection, infrastructure and secure delivery posture." },
  { href: "/enterprise/delivery", label: "Enterprise delivery", description: "Discovery through production rollout with staged risk reduction." },
] as const
