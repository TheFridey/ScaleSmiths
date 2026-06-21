import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import type { ForgeIntakeData } from "./forge"
import type { ForgeResearchReport } from "./forge-research"
import type { ForgeSitemapStrategy, ForgeSitemapPage } from "./forge-sitemap"
import { validateJsonSchemaValue } from "./forge-ai"

export const FORGE_COPY_ARTIFACT_TITLE = "Copy Document"
export const FORGE_COPY_ARTIFACT_KIND = "forge_copy_document"

export const FORGE_GENERIC_COPY_PHRASES = [
  "unlock your potential",
  "elevate your business",
  "cutting-edge solutions",
  "seamless experience",
  "tailored solutions",
  "in today's digital landscape",
] as const

export type ForgeCopyCheckStatus = "pass" | "review"

export interface ForgeCopySection extends Record<string, JsonValue> {
  heading: string
  body: string
}

export interface ForgeCopyFaq extends Record<string, JsonValue> {
  question: string
  answer: string
}

export interface ForgePageCopy extends Record<string, JsonValue> {
  pageTitle: string
  path: string
  seoTitle: string
  metaDescription: string
  h1: string
  heroSubheading: string
  primaryCta: string
  secondaryCta: string
  sectionHeadings: string[]
  sections: ForgeCopySection[]
  faqItems: ForgeCopyFaq[]
  trustProofCopy: string
  serviceDescriptions: string[]
  localSeoCopy: string
}

export interface ForgeCopySelfCheck extends Record<string, JsonValue> {
  status: ForgeCopyCheckStatus
  flaggedPhrases: string[]
  warnings: string[]
  notes: string[]
}

export interface ForgeCopyDocument extends Record<string, JsonValue> {
  copySummary: string
  pages: ForgePageCopy[]
  selfCheck: ForgeCopySelfCheck
}

export interface ForgeCopyProjectContext {
  id?: number
  name: string
  businessName: string
  industry: string | null
  brandNotes: string | null
  targetAudience: string | null
  primaryGoal: string | null
}

export interface ForgeCopyArtifactState {
  copy: ForgeCopyDocument | null
  approvedCopy: ForgeCopyDocument | null
  status: "draft" | "approved" | "empty"
  approvedAt: string | null
  approvedBy: string | null
}

export const FORGE_COPY_DOCUMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["copySummary", "pages", "selfCheck"],
  properties: {
    copySummary: { type: "string", description: "Short summary of the copy direction and conversion strategy." },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "pageTitle",
          "path",
          "seoTitle",
          "metaDescription",
          "h1",
          "heroSubheading",
          "primaryCta",
          "secondaryCta",
          "sectionHeadings",
          "sections",
          "faqItems",
          "trustProofCopy",
          "serviceDescriptions",
          "localSeoCopy",
        ],
        properties: {
          pageTitle: { type: "string" },
          path: { type: "string" },
          seoTitle: { type: "string" },
          metaDescription: { type: "string" },
          h1: { type: "string" },
          heroSubheading: { type: "string" },
          primaryCta: { type: "string" },
          secondaryCta: { type: "string" },
          sectionHeadings: { type: "array", items: { type: "string" } },
          sections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["heading", "body"],
              properties: {
                heading: { type: "string" },
                body: { type: "string" },
              },
            },
          },
          faqItems: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["question", "answer"],
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
              },
            },
          },
          trustProofCopy: { type: "string" },
          serviceDescriptions: { type: "array", items: { type: "string" } },
          localSeoCopy: { type: "string" },
        },
      },
    },
    selfCheck: {
      type: "object",
      additionalProperties: false,
      required: ["status", "flaggedPhrases", "warnings", "notes"],
      properties: {
        status: { type: "string", enum: ["pass", "review"] },
        flaggedPhrases: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        notes: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const satisfies ForgeJsonSchema

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function parseForgeCopyDocumentPayload(input: unknown): ParseResult<ForgeCopyDocument> {
  const errors = validateJsonSchemaValue(FORGE_COPY_DOCUMENT_SCHEMA, input)
  if (errors.length) return { ok: false, error: errors.join(" ") }
  return { ok: true, data: normalizeCopySelfCheck(input as ForgeCopyDocument) }
}

export function readForgeCopyDocumentArtifact(metadata: Record<string, unknown> | null | undefined): ForgeCopyArtifactState {
  if (!metadata || metadata.kind !== FORGE_COPY_ARTIFACT_KIND) {
    return {
      copy: null,
      approvedCopy: null,
      status: "empty",
      approvedAt: null,
      approvedBy: null,
    }
  }

  const copy = parseForgeCopyDocumentPayload(metadata.copy).ok
    ? normalizeCopySelfCheck(metadata.copy as ForgeCopyDocument)
    : null
  const approvedCopy = parseForgeCopyDocumentPayload(metadata.approvedCopy).ok
    ? normalizeCopySelfCheck(metadata.approvedCopy as ForgeCopyDocument)
    : null

  return {
    copy,
    approvedCopy,
    status: metadata.status === "approved" && approvedCopy ? "approved" : copy ? "draft" : "empty",
    approvedAt: typeof metadata.approvedAt === "string" ? metadata.approvedAt : null,
    approvedBy: typeof metadata.approvedBy === "string" ? metadata.approvedBy : null,
  }
}

export function buildForgeCopyPrompt({
  project,
  approvedSitemap,
  researchReport,
  intakeSummary,
  regeneratePagePath,
  existingCopy,
}: {
  project: ForgeCopyProjectContext
  approvedSitemap: ForgeSitemapStrategy
  researchReport: ForgeResearchReport | null
  intakeSummary: string
  regeneratePagePath?: string | null
  existingCopy?: ForgeCopyDocument | null
}) {
  const lines = [
    "Generate practical website copy for a real local/service business.",
    "Use the approved sitemap as the source of truth for page list, intent, CTA, proof, and conversion notes.",
    "Write concrete copy that sounds human, specific, and commercially useful.",
    `Avoid these generic phrases exactly: ${FORGE_GENERIC_COPY_PHRASES.join(", ")}.`,
    "Do not use vague AI filler, generic SaaS positioning, or inflated claims not supported by the intake or research.",
    "Return a complete structured copy document with a self-check that flags generic or sloppy copy.",
    regeneratePagePath ? `Regenerate the page at ${regeneratePagePath}, preserve the rest of the document where possible, and still return the complete copy document.` : "Generate copy for every approved sitemap page.",
    "",
    "Project:",
    `- Project name: ${project.name}`,
    `- Business name: ${project.businessName}`,
    `- Industry: ${project.industry ?? "Not provided"}`,
    `- Brand notes: ${project.brandNotes ?? "Not provided"}`,
    `- Target audience: ${project.targetAudience ?? "Not provided"}`,
    `- Primary goal: ${project.primaryGoal ?? "Not provided"}`,
    "",
    "Approved sitemap:",
    JSON.stringify(approvedSitemap, null, 2),
    "",
    "Research report:",
    researchReport ? JSON.stringify(researchReport, null, 2) : "No research report available. Use intake and sitemap context only.",
    "",
    "Intake summary:",
    intakeSummary || "No intake summary available.",
  ]

  if (existingCopy) {
    lines.push("", "Existing copy document:", JSON.stringify(existingCopy, null, 2))
  }

  return lines.join("\n")
}

export function buildForgeCopyArtifactContent(copy: ForgeCopyDocument) {
  const lines = [
    "# Copy Document",
    "",
    "## Copy summary",
    copy.copySummary,
    "",
    "## Self-check",
    `- Status: ${copy.selfCheck.status}`,
    `- Flagged phrases: ${copy.selfCheck.flaggedPhrases.join("; ") || "None"}`,
    ...copy.selfCheck.warnings.map((warning) => `- Warning: ${warning}`),
    "",
    "## Pages",
    ...copy.pages.flatMap((page, index) => [
      `### ${index + 1}. ${page.pageTitle}`,
      `- Path: ${page.path}`,
      `- SEO title: ${page.seoTitle}`,
      `- Meta description: ${page.metaDescription}`,
      `- H1: ${page.h1}`,
      `- Hero subheading: ${page.heroSubheading}`,
      `- Primary CTA: ${page.primaryCta}`,
      `- Secondary CTA: ${page.secondaryCta}`,
      "",
      "#### Sections",
      ...page.sections.map((section) => `- ${section.heading}: ${section.body}`),
      "",
      "#### FAQs",
      ...page.faqItems.map((faq) => `- ${faq.question} ${faq.answer}`),
      "",
      `#### Trust/proof copy\n${page.trustProofCopy}`,
      "",
      "#### Service descriptions",
      ...page.serviceDescriptions.map((description) => `- ${description}`),
      "",
      `#### Local SEO copy\n${page.localSeoCopy}`,
      "",
    ]),
  ]

  return lines.join("\n").trim()
}

export function createMockCopyDocument(project: ForgeCopyProjectContext, approvedSitemap: ForgeSitemapStrategy, intake: ForgeIntakeData, researchReport: ForgeResearchReport | null): ForgeCopyDocument {
  const businessName = project.businessName || project.name
  const audience = project.targetAudience || intake.idealCustomers || "customers who need a clear, reliable provider"
  const location = intake.primaryLocation || intake.businessLocation || "the local service area"
  const proof = splitList(intake.testimonials || "customer reviews, clear process, and practical evidence")
  const services = splitList(intake.coreServices || approvedSitemap.sitemap.map((page) => page.title).join("\n"))

  const pages = approvedSitemap.sitemap.map((page) => createMockPageCopy({
    page,
    businessName,
    audience,
    location,
    proof,
    services,
    researchReport,
  }))
  const draft: ForgeCopyDocument = {
    copySummary: `${businessName} copy is written around clear service value, local relevance, proof close to each claim, and direct enquiry actions for ${audience}.`,
    pages,
    selfCheck: {
      status: "pass",
      flaggedPhrases: [],
      warnings: [],
      notes: ["Mock copy uses specific service, location, CTA, and proof context."],
    },
  }

  return normalizeCopySelfCheck(draft)
}

export function normalizeCopySelfCheck(copy: ForgeCopyDocument): ForgeCopyDocument {
  const check = runForgeCopySelfCheck(copy)
  return {
    ...copy,
    selfCheck: {
      status: check.flaggedPhrases.length || check.warnings.length ? "review" : "pass",
      flaggedPhrases: check.flaggedPhrases,
      warnings: check.warnings,
      notes: check.notes,
    },
  }
}

export function runForgeCopySelfCheck(copy: ForgeCopyDocument): ForgeCopySelfCheck {
  const haystack = JSON.stringify(copy).toLowerCase()
  const flaggedPhrases = FORGE_GENERIC_COPY_PHRASES.filter((phrase) => haystack.includes(phrase))
  const warnings: string[] = []

  for (const page of copy.pages) {
    if (page.metaDescription.length > 170) warnings.push(`${page.pageTitle}: meta description may be too long.`)
    if (page.sections.length < 2) warnings.push(`${page.pageTitle}: add more section copy.`)
    if (page.faqItems.length < 2) warnings.push(`${page.pageTitle}: add more FAQ support.`)
    if (!page.trustProofCopy.trim()) warnings.push(`${page.pageTitle}: trust/proof copy is missing.`)
  }

  return {
    status: flaggedPhrases.length || warnings.length ? "review" : "pass",
    flaggedPhrases,
    warnings,
    notes: flaggedPhrases.length
      ? ["Review and replace generic phrases before approval."]
      : ["No banned generic phrases detected."],
  }
}

function createMockPageCopy({
  page,
  businessName,
  audience,
  location,
  proof,
  services,
  researchReport,
}: {
  page: ForgeSitemapPage
  businessName: string
  audience: string
  location: string
  proof: string[]
  services: string[]
  researchReport: ForgeResearchReport | null
}): ForgePageCopy {
  const service = services.find((item) => page.title.toLowerCase().includes(item.toLowerCase())) ?? page.title
  const proofLine = proof.slice(0, 2).join(" and ") || "clear process and useful evidence"
  const cta = page.primaryCta || "Request a quote"
  const contentCue = researchReport?.contentOpportunities[0] ?? "buyer questions and practical service detail"

  return {
    pageTitle: page.title,
    path: page.path,
    seoTitle: `${page.title} | ${businessName}`,
    metaDescription: `${businessName} helps ${audience} with ${service.toLowerCase()} in ${location}. Get clear advice, practical proof, and a fast route to enquiry.`,
    h1: page.title === "Home" ? `${businessName}: clear help for ${audience}` : `${page.title} for ${audience}`,
    heroSubheading: `${page.pagePurpose} We keep the message clear, prove the promise with ${proofLine}, and make it easy to take the next step.`,
    primaryCta: cta,
    secondaryCta: "View our process",
    sectionHeadings: ["What you get", "Why customers choose us", "How the next step works"],
    sections: [
      {
        heading: "What you get",
        body: `${businessName} gives visitors the details they need before contacting you: what the service covers, who it is for, where it is available, and how to move forward without confusion. Build the page around ${contentCue.toLowerCase()}.`,
      },
      {
        heading: "Why customers choose us",
        body: `The page should back up every claim with ${proofLine}. Keep the copy direct, specific, and connected to the problems ${audience} already recognise.`,
      },
      {
        heading: "How the next step works",
        body: `Invite visitors to ${cta.toLowerCase()} and explain what happens after they enquire, including response expectations and what information helps the team reply usefully.`,
      },
    ],
    faqItems: [
      {
        question: `Do you help customers in ${location}?`,
        answer: `Yes. This page should explain the core service area and invite visitors nearby to ask about availability.`,
      },
      {
        question: `What should I include when I ${cta.toLowerCase()}?`,
        answer: "Share the service you need, timing, location, and any useful context so the first reply can be practical.",
      },
      {
        question: `How does ${businessName} prove quality?`,
        answer: `Use this section to reference ${proofLine}, relevant examples, process detail, and standards that reduce buyer doubt.`,
      },
    ],
    trustProofCopy: `Trust should appear close to the CTA. Use ${proofLine}, practical process details, and real customer evidence so visitors can believe the claims before they enquire.`,
    serviceDescriptions: services.slice(0, 4).map((item) => `${item}: clear explanation of who it helps, what is included, and when a visitor should ask for it.`),
    localSeoCopy: `${businessName} supports ${audience} across ${location}. The page should mention the service area naturally, answer local buying questions, and link to the strongest service and contact pages.`,
  }
}

function splitList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}
