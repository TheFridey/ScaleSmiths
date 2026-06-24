import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type ClientRequestCategory,
  type ClientRequestPriority,
} from "./client-requests"

export const CLIENT_REQUEST_COMPLEXITIES = ["quick", "standard", "complex"] as const

export type ClientRequestComplexity = (typeof CLIENT_REQUEST_COMPLEXITIES)[number]

export interface ClientRequestTriageInput {
  title: string
  description: string
  category: ClientRequestCategory
  priority: ClientRequestPriority
  affectedUrl?: string | null
  clientContext?: string | null
}

export interface ClientRequestTriageResult extends Record<string, JsonValue> {
  summary: string
  suggestedCategory: ClientRequestCategory
  suggestedPriority: ClientRequestPriority
  estimatedComplexity: ClientRequestComplexity
  suggestedAdminChecklist: string[]
  suggestedClientReply: string
}

export const CLIENT_REQUEST_TRIAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "suggestedCategory",
    "suggestedPriority",
    "estimatedComplexity",
    "suggestedAdminChecklist",
    "suggestedClientReply",
  ],
  properties: {
    summary: { type: "string", description: "Concise internal summary of the client request." },
    suggestedCategory: { type: "string", enum: ["website_update", "website_issue", "form_issue", "seo_request", "new_page", "content_assets", "urgent_support", "general_support"] },
    suggestedPriority: { type: "string", enum: ["low", "medium", "high", "critical"] },
    estimatedComplexity: { type: "string", enum: ["quick", "standard", "complex"] },
    suggestedAdminChecklist: { type: "array", items: { type: "string" }, description: "Actionable internal checklist for admin triage." },
    suggestedClientReply: { type: "string", description: "Draft reply for an admin to review before sending." },
  },
} as const satisfies ForgeJsonSchema

export function createFallbackClientRequestTriage(input: ClientRequestTriageInput): ClientRequestTriageResult {
  const text = `${input.title} ${input.description} ${input.affectedUrl ?? ""}`.toLowerCase()
  const suggestedCategory = inferCategory(text, input.category)
  const suggestedPriority = inferPriority(text, input.priority, suggestedCategory)
  const estimatedComplexity = inferComplexity(text, suggestedCategory, suggestedPriority)
  const checklist = buildChecklist(suggestedCategory, suggestedPriority, estimatedComplexity, Boolean(input.affectedUrl))

  return {
    summary: buildSummary(input, suggestedCategory, suggestedPriority, estimatedComplexity),
    suggestedCategory,
    suggestedPriority,
    estimatedComplexity,
    suggestedAdminChecklist: checklist,
    suggestedClientReply: buildSuggestedReply(input, suggestedCategory, suggestedPriority),
  }
}

export function buildClientRequestTriagePrompt(input: ClientRequestTriageInput) {
  return [
    "Triage this ScaleSmiths client portal request for an admin user.",
    "Use only the supplied text. Do not claim to have crawled, visited, inspected, tested, or verified the live website.",
    "Return practical suggestions only; nothing is sent to the client automatically.",
    "",
    `Client/business context: ${input.clientContext ?? "Not provided"}`,
    `Submitted category: ${CATEGORY_LABELS[input.category]}`,
    `Submitted priority: ${PRIORITY_LABELS[input.priority]}`,
    `Affected URL: ${input.affectedUrl ?? "Not provided"}`,
    `Title: ${input.title}`,
    "Description:",
    input.description,
  ].join("\n")
}

export function formatClientRequestTriageSummary(result: ClientRequestTriageResult) {
  return [
    result.summary,
    "",
    `Suggested category: ${CATEGORY_LABELS[result.suggestedCategory]}`,
    `Suggested priority: ${PRIORITY_LABELS[result.suggestedPriority]}`,
    `Estimated complexity: ${result.estimatedComplexity}`,
  ].join("\n").trim()
}

export function formatClientRequestTriageChecklist(result: ClientRequestTriageResult) {
  return result.suggestedAdminChecklist.map((item) => `- ${item}`).join("\n")
}

function inferCategory(text: string, fallback: ClientRequestCategory): ClientRequestCategory {
  if (matches(text, ["site down", "website down", "offline", "ssl", "domain", "payment", "checkout"])) return "urgent_support"
  if (matches(text, ["form", "contact form", "enquiry", "enquiry form", "lead form", "submit button"])) return "form_issue"
  if (matches(text, ["seo", "ranking", "rankings", "google", "search console", "meta title", "meta description"])) return "seo_request"
  if (matches(text, ["new page", "landing page", "service page", "add a page"])) return "new_page"
  if (matches(text, ["image", "images", "photo", "photos", "logo", "asset", "content", "copy", "text"])) return "content_assets"
  if (matches(text, ["broken", "bug", "error", "not working", "stopped working", "404", "layout", "mobile"])) return "website_issue"
  if (matches(text, ["update", "change", "replace", "amend", "edit"])) return "website_update"
  return fallback
}

function inferPriority(text: string, fallback: ClientRequestPriority, category: ClientRequestCategory): ClientRequestPriority {
  if (category === "urgent_support" || matches(text, ["site down", "website down", "offline", "ssl", "domain", "payment", "checkout", "contact form broken"])) return "critical"
  if (matches(text, ["urgent", "asap", "important", "leads", "sales", "cannot", "not working", "stopped working", "broken"])) return "high"
  if (matches(text, ["typo", "minor", "small", "quick", "swap image", "change text"])) return "low"
  return fallback
}

function inferComplexity(text: string, category: ClientRequestCategory, priority: ClientRequestPriority): ClientRequestComplexity {
  if (priority === "critical" || matches(text, ["payment", "checkout", "domain", "ssl", "migration", "integration"])) return "complex"
  if (category === "new_page" || category === "seo_request" || category === "urgent_support") return "complex"
  if (category === "website_update" || priority === "low") return "quick"
  return "standard"
}

function buildSummary(
  input: ClientRequestTriageInput,
  suggestedCategory: ClientRequestCategory,
  suggestedPriority: ClientRequestPriority,
  estimatedComplexity: ClientRequestComplexity,
) {
  const url = input.affectedUrl ? ` The affected URL is ${input.affectedUrl}.` : ""
  return `Client submitted "${input.title}" as ${CATEGORY_LABELS[input.category]} with ${PRIORITY_LABELS[input.priority].toLowerCase()} priority. Forge suggests ${CATEGORY_LABELS[suggestedCategory].toLowerCase()}, ${PRIORITY_LABELS[suggestedPriority].toLowerCase()} priority, and ${estimatedComplexity} complexity.${url}`
}

function buildChecklist(
  category: ClientRequestCategory,
  priority: ClientRequestPriority,
  complexity: ClientRequestComplexity,
  hasAffectedUrl: boolean,
) {
  const items = [
    "Confirm the client-visible problem and desired outcome.",
    hasAffectedUrl ? "Open the affected URL and reproduce or inspect the request." : "Ask for the exact affected page or example if needed.",
  ]

  if (priority === "critical") items.push("Check whether the issue affects enquiries, payments, domain, SSL, or site availability.")
  if (category === "form_issue") items.push("Test the form submission path and confirm notification delivery.")
  if (category === "seo_request") items.push("Check current page intent, metadata, headings, and Search Console context if available.")
  if (category === "new_page") items.push("Confirm page goal, target audience, required copy/assets, and navigation placement.")
  if (category === "content_assets") items.push("Confirm replacement assets are final, correctly sized, and approved.")

  items.push(complexity === "quick" ? "Estimate whether this can be completed in a short maintenance slot." : "Break the work into implementation, QA, and client confirmation steps.")
  items.push("Update request status and add an internal note before replying.")

  return items
}

function buildSuggestedReply(input: ClientRequestTriageInput, category: ClientRequestCategory, priority: ClientRequestPriority) {
  const urgency = priority === "critical"
    ? "We will treat this as urgent and check the business-critical paths first."
    : "We will review the details and confirm the next step."
  const urlLine = input.affectedUrl ? ` We have the affected page as ${input.affectedUrl}.` : " If there is a specific affected page, please send it over."

  return `Thanks for sending this through. ${urgency}${urlLine} We will take a look, add any questions here if needed, and keep you updated as it moves through the queue.`
}

function matches(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}
