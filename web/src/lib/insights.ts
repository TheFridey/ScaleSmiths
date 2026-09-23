import { founderBySlug, type Founder } from "./founders"
import { initialInsights } from "./insight-library"

export type InsightStatus = "planned" | "draft" | "published"
export const INSIGHT_CATEGORIES = {
  "technical-seo": { label: "Technical SEO", description: "Practical indexing, local search, measurement and site-quality guidance." },
  "local-growth": { label: "Local growth", description: "How local service businesses become easier to find, understand and contact." },
  "web-development": { label: "Web development", description: "Websites, applications, frameworks and the engineering decisions behind them." },
  "business-systems": { label: "Business systems", description: "Automation, connected workflows and operational software." },
  infrastructure: { label: "Infrastructure", description: "Hosting, availability, domains and dependable business email." },
  commercial: { label: "Buying digital work", description: "Costs, scope, timelines and how to make sound website decisions." },
} as const
export type InsightCategory = keyof typeof INSIGHT_CATEGORIES

export const INSIGHT_TOPIC_CLUSTERS = {
  websites: { label: "Websites", description: "Clear guidance on planning, buying, rebuilding and owning a business website.", categories: ["commercial"] },
  seo: { label: "SEO", description: "Practical search guidance for UK businesses, from indexation and speed to local visibility.", categories: ["technical-seo", "local-growth"] },
  growth: { label: "Growth", description: "Commercial decisions, local visibility and better routes from attention to enquiry.", categories: ["local-growth", "commercial"] },
  development: { label: "Development", description: "Custom websites, web applications, software and maintainable technical choices.", categories: ["web-development"] },
  automation: { label: "Automation", description: "Connected workflows, integrations and focused business automation.", categories: ["business-systems", "web-development"] },
  infrastructure: { label: "Infrastructure", description: "Hosting, reliability, maintenance, domains and business email foundations.", categories: ["infrastructure"] },
} as const satisfies Record<string, { label: string; description: string; categories: readonly InsightCategory[] }>
export type InsightTopicSlug = keyof typeof INSIGHT_TOPIC_CLUSTERS

export type InsightBlock =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title: string; text: string }
  | { type: "image"; src: string; alt: string; width: number; height: number; caption?: string }
  | { type: "code"; language: string; code: string }
  | { type: "authorNote"; text: string }

export interface InsightBrief { targetQuery: string; searchIntent: string; angle: string; outline: string[]; firstHandEvidence: string[]; cannibalisationNotes?: string; priority: number }
export interface Insight {
  slug: string; title: string; seoTitle?: string; description: string; status: InsightStatus; authorSlug: string; category: InsightCategory
  datePublished?: string; dateModified?: string; heroImage?: { src: string; alt: string; width: number; height: number }
  body: InsightBlock[]; brief: InsightBrief; relatedServices: string[]; relatedCaseStudies: string[]; relatedInsights?: string[]; featured?: boolean
}

export const insights: Insight[] = initialInsights
const WORDS_PER_MINUTE = 220
export function draftPreviewEnabled(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>) { return env.NODE_ENV !== "production" }
export function publishedInsights(): Insight[] { return insights.filter((insight) => insight.status === "published").sort((a, b) => (b.datePublished ?? "").localeCompare(a.datePublished ?? "")) }
export function insightsForTopic(topic: InsightTopicSlug): Insight[] { const categories = INSIGHT_TOPIC_CLUSTERS[topic].categories as readonly InsightCategory[]; return publishedInsights().filter((insight) => categories.includes(insight.category)) }
export function insightTopic(insight: Insight): InsightTopicSlug { return (Object.keys(INSIGHT_TOPIC_CLUSTERS) as InsightTopicSlug[]).find((topic) => (INSIGHT_TOPIC_CLUSTERS[topic].categories as readonly InsightCategory[]).includes(insight.category)) ?? "websites" }
export function getInsight(slug: string, { includeDrafts = draftPreviewEnabled() } = {}): Insight | undefined { const insight = insights.find((candidate) => candidate.slug === slug); return insight && (insight.status === "published" || includeDrafts) ? insight : undefined }
export function insightAuthor(insight: Insight): Founder { const founder = founderBySlug(insight.authorSlug); if (!founder) throw new Error(`Insight ${insight.slug} has unknown author ${insight.authorSlug}`); return founder }
export function insightPlainText(insight: Insight): string { return insight.body.flatMap((block) => { switch (block.type) { case "heading": case "subheading": case "paragraph": return [block.text]; case "list": return block.items; case "quote": return [block.text]; case "callout": return [block.title, block.text]; case "image": return block.caption ? [block.caption] : []; default: return [] } }).join(" ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") }
export function insightWordCount(insight: Insight): number { return insightPlainText(insight).split(/\s+/).filter(Boolean).length }
export function readingTimeMinutes(insight: Insight): number { return Math.max(1, Math.ceil(insightWordCount(insight) / WORDS_PER_MINUTE)) }
export function headingId(text: string): string { return text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }
export function tableOfContents(insight: Insight) { return insight.body.filter((block): block is Extract<InsightBlock, { type: "heading" }> => block.type === "heading").map((block) => ({ id: headingId(block.text), text: block.text })) }
export function relatedInsights(insight: Insight, { includeDrafts = false, limit = 3 } = {}): Insight[] { const visible = (candidate: Insight) => candidate.slug !== insight.slug && (candidate.status === "published" || (includeDrafts && candidate.status === "draft")); const picked = (insight.relatedInsights ?? []).map((slug) => insights.find((candidate) => candidate.slug === slug)).filter((candidate): candidate is Insight => Boolean(candidate && visible(candidate))); const sameTopic = insights.filter((candidate) => visible(candidate) && insightTopic(candidate) === insightTopic(insight) && !picked.includes(candidate)); return [...picked, ...sameTopic].slice(0, limit) }
export function insightsForService(href: string, limit = 3): Insight[] { return publishedInsights().filter((insight) => insight.relatedServices.includes(href)).slice(0, limit) }
export function insightsForCaseStudy(slug: string, limit = 3): Insight[] { return publishedInsights().filter((insight) => insight.relatedCaseStudies.includes(slug)).slice(0, limit) }
export function insightsByAuthor(founderSlug: string): Insight[] { return publishedInsights().filter((insight) => insight.authorSlug === founderSlug) }
export function editorialPipeline(): Insight[] { return insights.filter((insight) => insight.status !== "published").sort((a, b) => a.brief.priority - b.brief.priority) }
