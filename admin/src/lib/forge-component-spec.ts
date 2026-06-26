import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import type { ForgeCopyDocument } from "./forge-copy"
import type { ForgeDesignDirection } from "./forge-design"
import type { ForgeSitemapStrategy } from "./forge-sitemap"
import { validateJsonSchemaValue } from "./forge-ai"

export const FORGE_COMPONENT_SPEC_ARTIFACT_TITLE = "Component Specification"
export const FORGE_COMPONENT_SPEC_ARTIFACT_KIND = "forge_component_spec"

export const FORGE_REQUIRED_COMPONENTS = [
  "Hero",
  "TrustBar",
  "ServicesGrid",
  "ServiceDetail",
  "ProcessSection",
  "ReviewsSection",
  "FAQSection",
  "ContactSection",
  "WhatsAppCTA",
  "LeadForm",
  "LocalSEOSection",
] as const

export interface ForgeComponentSpecTemplate extends Record<string, JsonValue> {
  name: string
  appliesTo: string[]
  layoutNotes: string
  sections: string[]
}

export interface ForgeComponentSpecPage extends Record<string, JsonValue> {
  pageTitle: string
  path: string
  template: string
  sectionOrder: string[]
  metadataRequirements: string[]
  schemaRequirements: string[]
  responsiveBehaviour: string[]
}

export interface ForgeComponentSpecComponent extends Record<string, JsonValue> {
  name: string
  purpose: string
  usedOn: string[]
  props: string[]
  dataRequirements: string[]
  animationRequirements: string[]
  integrationPlaceholders: string[]
  responsiveBehaviour: string[]
}

export interface ForgeComponentSpecification extends Record<string, JsonValue> {
  specSummary: string
  globalLayout: string
  navbarStructure: string
  footerStructure: string
  pageTemplates: ForgeComponentSpecTemplate[]
  pages: ForgeComponentSpecPage[]
  components: ForgeComponentSpecComponent[]
  animationRequirements: string[]
  integrationPlaceholders: string[]
  schemaMetadataRequirements: string[]
  responsiveBehaviour: string[]
  codeGeneratorNotes: string[]
}

export interface ForgeComponentSpecArtifactState {
  spec: ForgeComponentSpecification | null
  approvedSpec: ForgeComponentSpecification | null
  status: "draft" | "approved" | "empty"
  approvedAt: string | null
  approvedBy: string | null
}

export const FORGE_COMPONENT_SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "specSummary",
    "globalLayout",
    "navbarStructure",
    "footerStructure",
    "pageTemplates",
    "pages",
    "components",
    "animationRequirements",
    "integrationPlaceholders",
    "schemaMetadataRequirements",
    "responsiveBehaviour",
    "codeGeneratorNotes",
  ],
  properties: {
    specSummary: { type: "string" },
    globalLayout: { type: "string" },
    navbarStructure: { type: "string" },
    footerStructure: { type: "string" },
    pageTemplates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "appliesTo", "layoutNotes", "sections"],
        properties: {
          name: { type: "string" },
          appliesTo: { type: "array", items: { type: "string" } },
          layoutNotes: { type: "string" },
          sections: { type: "array", items: { type: "string" } },
        },
      },
    },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageTitle", "path", "template", "sectionOrder", "metadataRequirements", "schemaRequirements", "responsiveBehaviour"],
        properties: {
          pageTitle: { type: "string" },
          path: { type: "string" },
          template: { type: "string" },
          sectionOrder: { type: "array", items: { type: "string" } },
          metadataRequirements: { type: "array", items: { type: "string" } },
          schemaRequirements: { type: "array", items: { type: "string" } },
          responsiveBehaviour: { type: "array", items: { type: "string" } },
        },
      },
    },
    components: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "purpose", "usedOn", "props", "dataRequirements", "animationRequirements", "integrationPlaceholders", "responsiveBehaviour"],
        properties: {
          name: { type: "string" },
          purpose: { type: "string" },
          usedOn: { type: "array", items: { type: "string" } },
          props: { type: "array", items: { type: "string" } },
          dataRequirements: { type: "array", items: { type: "string" } },
          animationRequirements: { type: "array", items: { type: "string" } },
          integrationPlaceholders: { type: "array", items: { type: "string" } },
          responsiveBehaviour: { type: "array", items: { type: "string" } },
        },
      },
    },
    animationRequirements: { type: "array", items: { type: "string" } },
    integrationPlaceholders: { type: "array", items: { type: "string" } },
    schemaMetadataRequirements: { type: "array", items: { type: "string" } },
    responsiveBehaviour: { type: "array", items: { type: "string" } },
    codeGeneratorNotes: { type: "array", items: { type: "string" } },
  },
} as const satisfies ForgeJsonSchema

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function parseForgeComponentSpecPayload(input: unknown): ParseResult<ForgeComponentSpecification> {
  const errors = validateJsonSchemaValue(FORGE_COMPONENT_SPEC_SCHEMA, input)
  if (errors.length) return { ok: false, error: errors.join(" ") }
  const spec = input as ForgeComponentSpecification
  const missing = FORGE_REQUIRED_COMPONENTS.filter((name) => !spec.components.some((component) => component.name === name))
  if (missing.length) return { ok: false, error: `Component specification is missing required components: ${missing.join(", ")}.` }
  return { ok: true, data: spec }
}

export function readForgeComponentSpecArtifact(metadata: Record<string, unknown> | null | undefined): ForgeComponentSpecArtifactState {
  if (!metadata || metadata.kind !== FORGE_COMPONENT_SPEC_ARTIFACT_KIND) {
    return { spec: null, approvedSpec: null, status: "empty", approvedAt: null, approvedBy: null }
  }

  const spec = parseForgeComponentSpecPayload(metadata.spec).ok ? metadata.spec as ForgeComponentSpecification : null
  const approvedSpec = parseForgeComponentSpecPayload(metadata.approvedSpec).ok ? metadata.approvedSpec as ForgeComponentSpecification : null

  return {
    spec,
    approvedSpec,
    status: metadata.status === "approved" && approvedSpec ? "approved" : spec ? "draft" : "empty",
    approvedAt: typeof metadata.approvedAt === "string" ? metadata.approvedAt : null,
    approvedBy: typeof metadata.approvedBy === "string" ? metadata.approvedBy : null,
  }
}

export function buildForgeComponentSpecPrompt({
  approvedSitemap,
  approvedCopy,
  approvedDesign,
}: {
  approvedSitemap: ForgeSitemapStrategy
  approvedCopy: ForgeCopyDocument
  approvedDesign: ForgeDesignDirection
}) {
  return [
    "Create a detailed component and page specification before code generation.",
    "This must be an exact implementation blueprint for the code generator, not a loose design brief.",
    `Required reusable components: ${FORGE_REQUIRED_COMPONENTS.join(", ")}.`,
    "For every page, specify page template, section order, metadata/schema requirements, and responsive behaviour.",
    "For every component, specify purpose, where used, props, data requirements, animation requirements, integration placeholders, and responsive behaviour.",
    "Keep animation instructions aligned with the approved design direction and avoid over-animation.",
    "",
    "Approved sitemap:",
    JSON.stringify(approvedSitemap, null, 2),
    "",
    "Approved copy:",
    JSON.stringify(approvedCopy, null, 2),
    "",
    "Approved design direction:",
    JSON.stringify(approvedDesign, null, 2),
  ].join("\n")
}

export function buildForgeComponentSpecArtifactContent(spec: ForgeComponentSpecification) {
  return [
    "# Component Specification",
    "",
    "## Summary",
    spec.specSummary,
    "",
    "## Global layout",
    spec.globalLayout,
    "",
    "## Navbar",
    spec.navbarStructure,
    "",
    "## Footer",
    spec.footerStructure,
    "",
    "## Page templates",
    ...spec.pageTemplates.flatMap((template) => [
      `### ${template.name}`,
      `- Applies to: ${template.appliesTo.join(", ")}`,
      `- Layout notes: ${template.layoutNotes}`,
      `- Sections: ${template.sections.join(" -> ")}`,
      "",
    ]),
    "## Pages",
    ...spec.pages.flatMap((page) => [
      `### ${page.pageTitle}`,
      `- Path: ${page.path}`,
      `- Template: ${page.template}`,
      `- Section order: ${page.sectionOrder.join(" -> ")}`,
      `- Metadata: ${page.metadataRequirements.join("; ")}`,
      `- Schema: ${page.schemaRequirements.join("; ")}`,
      `- Responsive: ${page.responsiveBehaviour.join("; ")}`,
      "",
    ]),
    "## Components",
    ...spec.components.flatMap((component) => [
      `### ${component.name}`,
      component.purpose,
      `- Used on: ${component.usedOn.join(", ")}`,
      `- Props: ${component.props.join("; ")}`,
      `- Data: ${component.dataRequirements.join("; ")}`,
      `- Animation: ${component.animationRequirements.join("; ")}`,
      `- Integrations: ${component.integrationPlaceholders.join("; ")}`,
      `- Responsive: ${component.responsiveBehaviour.join("; ")}`,
      "",
    ]),
    "## Code generator notes",
    ...spec.codeGeneratorNotes.map((note) => `- ${note}`),
  ].join("\n").trim()
}

export function createMockComponentSpec(approvedSitemap: ForgeSitemapStrategy, approvedCopy: ForgeCopyDocument, approvedDesign: ForgeDesignDirection): ForgeComponentSpecification {
  const paths = approvedSitemap.sitemap.map((page) => page.path)
  const servicePaths = approvedSitemap.sitemap.filter((page) => /service|repair|maintenance|area/i.test(page.title)).map((page) => page.path)
  const primaryCta = approvedCopy.pages[0]?.primaryCta ?? "Request a quote"
  const gaming = approvedSitemap.selectedStrategyPack === "gaming_community_server"

  return {
    specSummary: `Build a ${approvedDesign.selectedStylePack} website from the approved ${approvedSitemap.selectedStrategyPack} sitemap, copy, and design direction. The code generator should implement stable reusable sections, exact page ordering, restrained motion, and clear conversion placeholders.`,
    globalLayout: "Use one app/site shell with semantic header, main, footer, consistent max-width containers, skip-link support, and shared CTA/contact data.",
    navbarStructure: `Desktop nav: logo, primary page links from sitemap, compact CTA button labelled "${primaryCta}". Mobile nav: logo, menu trigger, stacked links, CTA, and WhatsApp placeholder.`,
    footerStructure: gaming
      ? "Footer includes server/community summary, play/join links, Discord/store/vote/support links, legal links, and no LocalBusiness NAP block unless explicitly supplied."
      : "Footer includes business summary, service links, service area links, contact block, WhatsApp placeholder, legal links, and LocalBusiness NAP/schema data source.",
    pageTemplates: [
      {
        name: "HomeTemplate",
        appliesTo: ["/"],
        layoutNotes: gaming ? "Hero-led server/community page with server IP, status/stat placeholders, game modes, Discord/store/vote CTAs, news/events, rules/support, and FAQ." : "Hero-led conversion page with proof, services, process, reviews, local SEO, FAQ, and contact.",
        sections: gaming ? ["Hero", "TrustBar", "ServicesGrid", "ProcessSection", "ReviewsSection", "FAQSection"] : ["Hero", "TrustBar", "ServicesGrid", "ProcessSection", "ReviewsSection", "LocalSEOSection", "FAQSection", "ContactSection"],
      },
      {
        name: "ServiceTemplate",
        appliesTo: servicePaths.length ? servicePaths : paths.filter((path) => path !== "/" && path !== "/contact"),
        layoutNotes: "Intent-specific service page with detailed service copy, proof, process, FAQs, and lead form.",
        sections: ["Hero", "TrustBar", "ServiceDetail", "ProcessSection", "ReviewsSection", "FAQSection", "LeadForm", "WhatsAppCTA"],
      },
      {
        name: "ContactTemplate",
        appliesTo: paths.filter((path) => /contact/i.test(path)),
        layoutNotes: "Contact-first page with concise reassurance, lead form, WhatsApp CTA, and local/service area details.",
        sections: ["Hero", "ContactSection", "LeadForm", "WhatsAppCTA", "FAQSection"],
      },
    ],
    pages: approvedSitemap.sitemap.map((page) => {
      const copyPage = approvedCopy.pages.find((item) => item.path === page.path)
      return {
        pageTitle: page.title,
        path: page.path,
        template: page.path === "/" ? "HomeTemplate" : /contact/i.test(page.path) ? "ContactTemplate" : "ServiceTemplate",
        sectionOrder: page.path === "/"
          ? ["Hero", "TrustBar", "ServicesGrid", "ProcessSection", "ReviewsSection", "LocalSEOSection", "FAQSection", "ContactSection"]
          : /contact/i.test(page.path)
            ? ["Hero", "ContactSection", "LeadForm", "WhatsAppCTA", "FAQSection"]
            : ["Hero", "TrustBar", "ServiceDetail", "ProcessSection", "ReviewsSection", "FAQSection", "LeadForm", "WhatsAppCTA"],
        metadataRequirements: [
          `SEO title: ${copyPage?.seoTitle ?? page.title}`,
          `Meta description: ${copyPage?.metaDescription ?? page.pagePurpose}`,
          `Canonical path: ${page.path}`,
        ],
        schemaRequirements: [page.schemaRecommendation, "BreadcrumbList where nested navigation exists"],
        responsiveBehaviour: ["Hero CTA remains visible without sticky overlap", "Cards collapse to one column under tablet width", "Forms use full-width inputs on mobile"],
      }
    }),
    components: FORGE_REQUIRED_COMPONENTS.map((name) => componentSpecFor(name, paths, approvedDesign, primaryCta)),
    animationRequirements: [
      approvedDesign.animationStyle,
      "Use motion only on Hero entry, card hover/focus states, process progression, and form feedback.",
      "Disable decorative motion when prefers-reduced-motion is set.",
    ],
    integrationPlaceholders: [
      "LeadForm submit handler placeholder for future Resend integration.",
      "WhatsAppCTA phone/message config placeholder.",
      "Analytics event names for primary CTA, secondary CTA, form submit, WhatsApp click.",
    ],
    schemaMetadataRequirements: [
      ...(gaming ? ["WebSite/Organization schema source object shared across layout.", "No LocalBusiness schema unless a true local venue/location is explicitly supplied."] : ["LocalBusiness schema source object shared across layout.", "Service schema per service/detail page."]),
      "FAQPage schema where FAQSection appears.",
      "ContactPoint schema on contact page/footer.",
    ],
    responsiveBehaviour: [
      "Mobile-first section spacing with no text overlap.",
      "Desktop uses constrained content width and two-column layouts only where copy remains readable.",
      "Navigation, CTA, and forms must remain keyboard accessible.",
    ],
    codeGeneratorNotes: [
      "Use approved copy verbatim unless mapping into props requires labels.",
      "Create a typed data object for pages, services, FAQs, reviews/proof, CTAs, and integrations.",
      "Do not invent new pages beyond approved sitemap.",
      "Do not implement live integrations yet; use explicit placeholders.",
    ],
  }
}

function componentSpecFor(name: string, paths: string[], design: ForgeDesignDirection, primaryCta: string): ForgeComponentSpecComponent {
  const usedOn = name === "ContactSection" || name === "LeadForm" ? paths.filter((path) => path === "/" || /contact|service|repair|maintenance/i.test(path)) : paths
  const baseResponsive = ["One column on mobile", "No layout shift on hover/focus", "Text wraps cleanly inside controls and cards"]

  const specs: Record<string, ForgeComponentSpecComponent> = {
    Hero: {
      name,
      purpose: "Introduce page intent, H1, subheading, primary/secondary CTA, and immediate trust cue.",
      usedOn: paths,
      props: ["eyebrow?", "h1", "subheading", "primaryCta", "secondaryCta?", "trustCue?", "image?"],
      dataRequirements: ["Page copy hero fields", "CTA labels/targets", "Optional image treatment from design direction"],
      animationRequirements: ["Short entry reveal only", "Respect reduced motion"],
      integrationPlaceholders: ["CTA analytics event"],
      responsiveBehaviour: baseResponsive,
    },
    TrustBar: {
      name,
      purpose: "Show concise proof signals close to claims and CTAs.",
      usedOn: paths,
      props: ["items", "variant?"],
      dataRequirements: ["Reviews", "certifications", "years trading", "response proof"],
      animationRequirements: ["Static or subtle count/reveal; no looping motion"],
      integrationPlaceholders: ["Future reviews source placeholder"],
      responsiveBehaviour: baseResponsive,
    },
    ServicesGrid: {
      name,
      purpose: "Route visitors from summary service options to detail pages.",
      usedOn: ["/"],
      props: ["services", "columns?", "ctaLabel"],
      dataRequirements: ["Approved sitemap service pages", "service descriptions", "target paths"],
      animationRequirements: ["Hover/focus state may reveal one proof point"],
      integrationPlaceholders: ["CTA analytics event"],
      responsiveBehaviour: baseResponsive,
    },
    ServiceDetail: {
      name,
      purpose: "Render service-specific body copy, benefits, proof, and next steps.",
      usedOn,
      props: ["title", "body", "benefits", "proof", "cta"],
      dataRequirements: ["Approved copy sections", "service descriptions", "trust/proof copy"],
      animationRequirements: ["Keep core copy static"],
      integrationPlaceholders: ["Lead form anchor target"],
      responsiveBehaviour: baseResponsive,
    },
    ProcessSection: {
      name,
      purpose: "Explain how enquiry, diagnosis, delivery, or follow-up works.",
      usedOn: paths,
      props: ["steps", "intro?", "cta?"],
      dataRequirements: ["Process copy", "CTA target"],
      animationRequirements: design.motionSections.includes("Process step progression") ? ["Step progression reveal allowed"] : ["Static steps preferred"],
      integrationPlaceholders: ["CTA analytics event"],
      responsiveBehaviour: baseResponsive,
    },
    ReviewsSection: {
      name,
      purpose: "Display testimonials, proof copy, and confidence markers.",
      usedOn: paths,
      props: ["reviews", "proofStats?", "intro?"],
      dataRequirements: ["Testimonials/reviews", "case study snippets", "trust proof copy"],
      animationRequirements: ["No auto-rotating carousel; static list or manual controls only"],
      integrationPlaceholders: ["Future reviews feed placeholder"],
      responsiveBehaviour: baseResponsive,
    },
    FAQSection: {
      name,
      purpose: "Answer buyer objections and feed FAQ schema.",
      usedOn: paths,
      props: ["items", "schemaEnabled"],
      dataRequirements: ["Approved copy FAQ items"],
      animationRequirements: ["Accordion open/close with reduced-motion fallback"],
      integrationPlaceholders: ["FAQPage schema generation"],
      responsiveBehaviour: baseResponsive,
    },
    ContactSection: {
      name,
      purpose: "Show contact routes, reassurance, location/service area, and form entry.",
      usedOn,
      props: ["heading", "intro", "contactMethods", "serviceArea", "formId"],
      dataRequirements: ["Contact copy", "business NAP", "service area"],
      animationRequirements: ["Static contact details"],
      integrationPlaceholders: ["Resend", "WhatsApp", "Analytics"],
      responsiveBehaviour: baseResponsive,
    },
    WhatsAppCTA: {
      name,
      purpose: "Provide a quick WhatsApp enquiry route without replacing the main lead form.",
      usedOn,
      props: ["phoneNumber", "message", "label"],
      dataRequirements: ["WhatsApp config placeholder", "CTA copy"],
      animationRequirements: ["Hover/focus feedback only"],
      integrationPlaceholders: ["WhatsApp phone/message env/config"],
      responsiveBehaviour: baseResponsive,
    },
    LeadForm: {
      name,
      purpose: `Collect qualified enquiries for "${primaryCta}" with minimal friction.`,
      usedOn,
      props: ["fields", "submitLabel", "successMessage", "sourcePage"],
      dataRequirements: ["name", "email", "company?", "phone?", "message", "intent/source page"],
      animationRequirements: ["Inline validation and submit state only"],
      integrationPlaceholders: ["Resend API route", "spam protection", "analytics conversion event"],
      responsiveBehaviour: baseResponsive,
    },
    LocalSEOSection: {
      name,
      purpose: "Support local search relevance with service area copy, links, and proof.",
      usedOn: paths.filter((path) => path === "/" || /area|service|repair|maintenance/i.test(path)),
      props: ["heading", "body", "areas", "links"],
      dataRequirements: ["local SEO copy", "service areas", "internal links"],
      animationRequirements: ["Static copy and links"],
      integrationPlaceholders: ["LocalBusiness/areaServed schema"],
      responsiveBehaviour: baseResponsive,
    },
  }

  return specs[name]
}
