import { founderBySlug, type Founder } from "./founders"

/**
 * Founder-written insights. The editorial rules are deliberate:
 *
 * - Only a founder writes an article, and the byline, profile link and structured data all name
 *   the same person. There are no ghost authors, reviewers or editorial staff.
 * - Every published article must contain first-hand evidence (a project, a decision, a
 *   measurement, a screenshot) listed in its brief. An article that could have been written by
 *   anyone does not get published.
 * - Planned and draft articles are never listed, linked, indexed or routable in production.
 * - `authorNote` blocks are drafting instructions. They render in development only and a
 *   published article may not contain any (enforced by insights.test.ts).
 *
 * See docs/content/seo-architecture.md for the topic map and cannibalisation notes.
 */

export type InsightStatus = "planned" | "draft" | "published"

export const INSIGHT_CATEGORIES = {
  "technical-seo": { label: "Technical SEO", description: "Site architecture, migrations, indexing and structured data." },
  "local-growth": { label: "Local growth", description: "How local service businesses get found, trusted and contacted." },
  "web-development": { label: "Web development", description: "Platforms, frameworks, hosting and the trade-offs behind them." },
  "business-systems": { label: "Business systems", description: "CRMs, portals, automation and the workflows behind the website." },
  commercial: { label: "Buying digital work", description: "What to expect, what to ask and how to judge value." },
} as const

export type InsightCategory = keyof typeof INSIGHT_CATEGORIES

/**
 * Article body. Paragraph and list text may contain links written as `[label](/path)` or
 * `[label](https://…)`; nothing else is interpreted, so no HTML can be injected.
 */
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

export interface InsightBrief {
  /** The question a searcher is really asking. */
  targetQuery: string
  /** Why they are asking, and what would genuinely help. */
  searchIntent: string
  /** ScaleSmiths' position, which must be defensible from real work. */
  angle: string
  outline: string[]
  /** Evidence the article must include before it can be published. */
  firstHandEvidence: string[]
  /** Existing or planned content this could compete with, and how to keep them distinct. */
  cannibalisationNotes?: string
  /** Lower number = write sooner. */
  priority: number
}

export interface Insight {
  slug: string
  title: string
  /** Meta description and card summary (≤ 160 characters). */
  description: string
  status: InsightStatus
  /** Founder slug. The founder's name is the byline and the schema author. */
  authorSlug: string
  category: InsightCategory
  /** ISO dates (YYYY-MM-DD). Required once published. */
  datePublished?: string
  dateModified?: string
  heroImage?: { src: string; alt: string; width: number; height: number }
  body: InsightBlock[]
  brief: InsightBrief
  /** Commercial pages a reader of this article may reasonably want next (hrefs). */
  relatedServices: string[]
  /** Case studies the article draws on (project slugs). */
  relatedCaseStudies: string[]
  /** Hand-picked related articles; falls back to the same category. */
  relatedInsights?: string[]
}

const WORDS_PER_MINUTE = 220

export const insights: Insight[] = [
  {
    slug: "what-a-website-rebuild-should-preserve-for-seo",
    title: "What a website rebuild should preserve for SEO",
    description: "The pages, links, metadata and tracking a rebuild must carry over, and how we check nothing was lost after launch.",
    status: "draft",
    authorSlug: "rhys",
    category: "technical-seo",
    body: [
      { type: "authorNote", text: "Draft skeleton for the article template. Replace every note with first-hand writing before changing the status to published." },
      { type: "authorNote", text: "Introduction: why a rebuild is the highest-risk moment for search visibility, in Rhys's own words, referencing a real project." },
      { type: "heading", text: "Start with an inventory, not a design" },
      { type: "authorNote", text: "Explain the crawl and Search Console export used before a rebuild. Include what was inventoried on the Pinkys Prints Shopify migration." },
      { type: "heading", text: "URLs and redirects" },
      { type: "authorNote", text: "Show a real (anonymised if needed) URL mapping table from a migration. Link to the website migration URLs article once published." },
      { type: "heading", text: "Content that already ranks" },
      { type: "authorNote", text: "How pages with impressions are identified and protected during content changes." },
      { type: "heading", text: "Metadata, headings and structured data" },
      { type: "authorNote", text: "What is carried over, what is improved, and how the difference is checked." },
      { type: "heading", text: "Tracking and conversions" },
      { type: "authorNote", text: "Analytics events, form tracking and Search Console verification across the switch." },
      { type: "heading", text: "The first 30 days after launch" },
      { type: "authorNote", text: "The post-launch checks actually run: crawl for 404s, redirect chains, indexing reports and enquiry volume." },
      { type: "callout", title: "Related service", text: "Planning a rebuild in Nottinghamshire? See [web design in Nottingham](/web-design-nottingham) or [talk to us about your current site](/contact)." },
    ],
    brief: {
      targetQuery: "website rebuild SEO checklist",
      searchIntent: "Owners about to redesign a site who are worried about losing rankings and want a concrete checklist they can hold an agency to.",
      angle: "Rebuilds lose rankings through avoidable omissions; a written inventory and redirect map before design starts is non-negotiable.",
      outline: ["Inventory before design", "URLs and redirects", "Content that already ranks", "Metadata, headings and structured data", "Tracking and conversions", "The first 30 days after launch"],
      firstHandEvidence: ["Pinkys Prints Shopify-to-custom migration: what was preserved", "A real redirect map or crawl comparison", "Post-launch Search Console screenshots from a ScaleSmiths rebuild"],
      cannibalisationNotes: "Owns the broad rebuild query. The URL-migration article must go deeper on redirects only and link back here.",
      priority: 1,
    },
    relatedServices: ["/web-design-nottingham", "/web-development-nottingham", "/digital-growth-partnership"],
    relatedCaseStudies: ["pinkys-prints", "precision-finish-plastering-rendering"],
    relatedInsights: ["why-keeping-existing-urls-matters-during-a-website-migration", "technical-seo-for-local-service-businesses"],
  },
  plannedInsight({
    slug: "what-actually-makes-a-local-business-website-rank",
    title: "What actually makes a local business website rank?",
    description: "Service pages, area pages, proof and technical foundations: what moves local search for service businesses, using real site structures.",
    authorSlug: "rhys",
    category: "local-growth",
    brief: {
      targetQuery: "how to rank a local business website",
      searchIntent: "Local service owners who have a website but little search visibility and want to know what genuinely matters.",
      angle: "Local ranking comes from specific service and area pages with real proof, plus a sound Google Business Profile — not from repeating place names.",
      outline: ["What Google needs to understand about a local business", "Service pages that stand on their own", "Area pages that say something specific", "Proof: projects, reviews and photos", "Technical foundations that stop good pages being ignored"],
      firstHandEvidence: ["Precision Finish service and location architecture", "Glow Tanning review aggregation", "Search Console data from a Nottinghamshire client, with permission"],
      cannibalisationNotes: "Strategic, buyer-level. The technical SEO article covers implementation detail; keep this one non-technical.",
      priority: 2,
    },
    relatedServices: ["/web-design-nottingham", "/web-design-hucknall", "/local-growth"],
    relatedCaseStudies: ["precision-finish-plastering-rendering", "glow-tanning"],
  }),
  plannedInsight({
    slug: "nextjs-vs-wordpress-for-uk-service-businesses",
    title: "Next.js vs WordPress for UK service businesses",
    description: "When WordPress is the sensible choice, when a custom Next.js build earns its cost, and the questions that decide it for a service business.",
    authorSlug: "rhys",
    category: "web-development",
    brief: {
      targetQuery: "Next.js vs WordPress",
      searchIntent: "Business owners or marketers choosing a platform for a rebuild, often after an agency recommended one or the other.",
      angle: "A fair comparison: WordPress suits many content sites; custom Next.js earns its cost when performance, integrations, security or product features matter.",
      outline: ["What each platform is good at", "Performance and Core Web Vitals in practice", "Editing content day to day", "Integrations and custom workflows", "Security and maintenance burden", "Total cost over three years", "How we decide for a client"],
      firstHandEvidence: ["CSDS Next.js build with quote admin", "Lighthouse or field data from a ScaleSmiths Next.js site", "A real case where WordPress was the right recommendation, if one exists"],
      cannibalisationNotes: "Strong overlap with the 'why we stopped recommending WordPress for complex platforms' idea. Publish this first; fold the complex-platforms argument in as a section unless it has distinct evidence.",
      priority: 3,
    },
    relatedServices: ["/next-js-agency-uk", "/web-development-nottingham", "/web-design-nottingham"],
    relatedCaseStudies: ["csds", "the-business-circle"],
  }),
  plannedInsight({
    slug: "why-your-website-shouldnt-be-separate-from-your-crm",
    title: "Why your website shouldn't be separate from your CRM",
    description: "What is lost when enquiries sit in an inbox, and practical ways to connect a website to the system that tracks customers and quotes.",
    authorSlug: "trevor-newton-bradley",
    category: "business-systems",
    brief: {
      targetQuery: "connect website to CRM",
      searchIntent: "Owners losing track of enquiries or re-keying details from website forms into another system.",
      angle: "The commercial cost of disconnected enquiries is follow-up that never happens; the fix is often a connection, not a new CRM.",
      outline: ["Where enquiries go missing", "What a connected enquiry looks like", "Connect an existing CRM or build a focused tool?", "Quote and follow-up workflows", "Measuring what happens after the form"],
      firstHandEvidence: ["CSDS multi-step quote form feeding a quote management admin", "Precision Finish photo-led enquiry journey", "ScaleSmiths' own prospect pipeline and client portal"],
      priority: 4,
    },
    relatedServices: ["/custom-systems", "/custom-web-app-development-uk", "/web-development-nottingham"],
    relatedCaseStudies: ["csds", "precision-finish-plastering-rendering"],
  }),
  plannedInsight({
    slug: "what-should-2000-buy-you-from-a-web-agency",
    title: "What should £2,000 actually buy you from a web agency?",
    description: "What a modest website budget can realistically cover, what gets cut, and the questions that reveal whether a quote is good value.",
    authorSlug: "trevor-newton-bradley",
    category: "commercial",
    brief: {
      targetQuery: "how much should a small business website cost UK",
      searchIntent: "Small business owners comparing quotes that vary wildly and wanting to judge value.",
      angle: "Honest scoping: what is realistic at a small budget, what corners are commonly cut, and when a focused repair beats a new site.",
      outline: ["What is realistic at this budget", "Where cheap quotes usually cut corners", "Ownership: domain, hosting, content and code", "Questions to ask any agency", "When a focused repair or audit is the better spend"],
      firstHandEvidence: ["Real (anonymised) scoping decisions from ScaleSmiths proposals", "The Business Growth Audit as an alternative starting point"],
      cannibalisationNotes: "Must stay consistent with verified pricing claims: the site publishes no price ranges without a verified claim, so the article discusses scope and value rather than quoting ScaleSmiths prices.",
      priority: 5,
    },
    relatedServices: ["/pricing", "/services/business-growth-audit", "/local-growth"],
    relatedCaseStudies: [],
  }),
  plannedInsight({
    slug: "service-and-location-pages-without-thin-content",
    title: "How we structure service and location pages without thin content",
    description: "How we decide which service and area pages deserve to exist, what each must contain, and why swapping place names does not work.",
    authorSlug: "rhys",
    category: "technical-seo",
    brief: {
      targetQuery: "location pages SEO",
      searchIntent: "Businesses and marketers planning service-area pages who want to avoid thin, duplicate content.",
      angle: "A page earns its place with specific work, coverage and questions for that service or area; otherwise consolidate.",
      outline: ["Deciding which pages should exist", "What every service page needs", "What makes an area page useful", "Internal linking between services, areas and projects", "When to consolidate instead"],
      firstHandEvidence: ["Precision Finish service, property-type and location architecture", "The ScaleSmiths landing page quality tests"],
      cannibalisationNotes: "Distinct from 'what makes a local site rank' (strategy) and 'technical SEO for local businesses' (implementation). This one is information architecture only.",
      priority: 6,
    },
    relatedServices: ["/web-design-nottingham", "/local-growth"],
    relatedCaseStudies: ["precision-finish-plastering-rendering"],
  }),
  plannedInsight({
    slug: "moving-off-managed-platforms-to-self-hosting",
    title: "Moving a growing store off managed platforms: what we learned",
    description: "Why Pinkys Prints moved from Shopify, Vercel and Supabase to a self-hosted stack, what it cost to do safely, and when we would not recommend it.",
    authorSlug: "rhys",
    category: "web-development",
    brief: {
      targetQuery: "move off Shopify to custom ecommerce",
      searchIntent: "E-commerce owners whose platform or hosting costs and limitations are growing faster than the business.",
      angle: "Self-hosting can reduce cost and increase control, but only with migration discipline and someone accountable for operations.",
      outline: ["Why the move was considered", "What was migrated and in what order", "Keeping the store live during cutover", "Operational responsibilities after the move", "When staying on a managed platform is right"],
      firstHandEvidence: ["Pinkys Prints migration from Shopify and Vercel + Supabase to Docker Compose on a VPS", "Verified cost or downtime figures only if approved as public claims"],
      priority: 7,
    },
    relatedServices: ["/e-commerce-development-nottingham", "/custom-systems"],
    relatedCaseStudies: ["pinkys-prints"],
  }),
  plannedInsight({
    slug: "technical-seo-for-local-service-businesses",
    title: "Technical SEO for local service businesses",
    description: "The technical checks that stop good local pages being ignored: indexing, structured data, page speed, internal links and Business Profile consistency.",
    authorSlug: "rhys",
    category: "technical-seo",
    brief: {
      targetQuery: "technical SEO for local business",
      searchIntent: "Owners or marketers who have content but suspect technical problems are holding the site back.",
      angle: "A short, prioritised technical checklist that matters for small local sites, rather than an enterprise audit.",
      outline: ["Indexing and canonical URLs", "Structured data that reflects the real business", "Page speed on mobile", "Internal links between services, areas and proof", "Keeping business details consistent"],
      firstHandEvidence: ["Structured data and sitemap approach used on ScaleSmiths client sites", "Before/after Lighthouse results from a real site, if available"],
      cannibalisationNotes: "Implementation-level companion to 'what makes a local site rank'. Consider merging if both would be under ~1,200 words.",
      priority: 8,
    },
    relatedServices: ["/web-design-hucknall", "/web-design-nottingham", "/digital-growth-partnership"],
    relatedCaseStudies: ["precision-finish-plastering-rendering"],
  }),
  plannedInsight({
    slug: "why-keeping-existing-urls-matters-during-a-website-migration",
    title: "Why keeping existing URLs matters during a website migration",
    description: "How changed URLs lose rankings and links, how to build a redirect map, and the mistakes that cause traffic to drop after a migration.",
    authorSlug: "rhys",
    category: "technical-seo",
    brief: {
      targetQuery: "website migration redirects SEO",
      searchIntent: "Teams mid-migration or recovering from a traffic drop after changing platform or URL structure.",
      angle: "Redirect mapping is the single highest-risk step in a migration and deserves its own plan and verification.",
      outline: ["What changes when a URL changes", "Building a redirect map", "Redirect chains, loops and soft 404s", "Verifying after launch"],
      firstHandEvidence: ["A real redirect map from a ScaleSmiths migration", "Crawl output showing redirect verification"],
      cannibalisationNotes: "Narrow companion to the rebuild article. If evidence is thin, publish as a section of that article instead.",
      priority: 9,
    },
    relatedServices: ["/web-development-nottingham", "/e-commerce-development-nottingham"],
    relatedCaseStudies: ["pinkys-prints"],
  }),
  plannedInsight({
    slug: "why-we-stopped-recommending-wordpress-for-complex-business-platforms",
    title: "Why we stopped recommending WordPress for complex business platforms",
    description: "Where plugin-based builds struggle with roles, billing, data and integrations, and what we build instead for platforms and portals.",
    authorSlug: "rhys",
    category: "web-development",
    brief: {
      targetQuery: "WordPress for web applications",
      searchIntent: "Founders being offered a WordPress-plus-plugins build for a membership platform, portal or SaaS product.",
      angle: "WordPress is fine for content; platforms with roles, billing and real data models need an application architecture.",
      outline: ["What counts as a complex platform", "Where plugin stacks break down", "Security and upgrade risk", "What we build instead", "Signs a WordPress build is still fine"],
      firstHandEvidence: ["The Business Circle: Auth.js roles, Stripe subscriptions, LiveKit", "VeteranFinder admin and member separation"],
      cannibalisationNotes: "High overlap with 'Next.js vs WordPress'. Only publish separately if it focuses on platforms/portals with its own evidence; never target the same comparison query.",
      priority: 10,
    },
    relatedServices: ["/custom-web-app-development-uk", "/next-js-agency-uk"],
    relatedCaseStudies: ["the-business-circle", "veteranfinder"],
  }),
]

function plannedInsight(insight: Omit<Insight, "status" | "body">): Insight {
  return { ...insight, status: "planned", body: [] }
}

export function draftPreviewEnabled(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>) {
  return env.NODE_ENV !== "production"
}

export function publishedInsights(): Insight[] {
  return insights
    .filter((insight) => insight.status === "published")
    .sort((a, b) => (b.datePublished ?? "").localeCompare(a.datePublished ?? ""))
}

export function getInsight(slug: string, { includeDrafts = draftPreviewEnabled() } = {}): Insight | undefined {
  const insight = insights.find((candidate) => candidate.slug === slug)
  if (!insight) return undefined
  return insight.status === "published" || includeDrafts ? insight : undefined
}

export function insightAuthor(insight: Insight): Founder {
  const founder = founderBySlug(insight.authorSlug)
  if (!founder) throw new Error(`Insight ${insight.slug} has unknown author ${insight.authorSlug}`)
  return founder
}

/** Plain text of the publishable body (drafting notes excluded). */
export function insightPlainText(insight: Insight): string {
  return insight.body
    .flatMap((block) => {
      switch (block.type) {
        case "heading":
        case "subheading":
        case "paragraph":
          return [block.text]
        case "list":
          return block.items
        case "quote":
          return [block.text]
        case "callout":
          return [block.title, block.text]
        case "image":
          return block.caption ? [block.caption] : []
        default:
          return []
      }
    })
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
}

export function insightWordCount(insight: Insight): number {
  return insightPlainText(insight).split(/\s+/).filter(Boolean).length
}

export function readingTimeMinutes(insight: Insight): number {
  return Math.max(1, Math.ceil(insightWordCount(insight) / WORDS_PER_MINUTE))
}

export function headingId(text: string): string {
  return text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function tableOfContents(insight: Insight): Array<{ id: string; text: string }> {
  return insight.body.filter((block): block is Extract<InsightBlock, { type: "heading" }> => block.type === "heading").map((block) => ({ id: headingId(block.text), text: block.text }))
}

export function relatedInsights(insight: Insight, { includeDrafts = false, limit = 3 } = {}): Insight[] {
  const visible = (candidate: Insight) => candidate.slug !== insight.slug && (candidate.status === "published" || (includeDrafts && candidate.status === "draft"))
  const picked = (insight.relatedInsights ?? []).map((slug) => insights.find((candidate) => candidate.slug === slug)).filter((candidate): candidate is Insight => Boolean(candidate && visible(candidate)))
  const sameCategory = insights.filter((candidate) => visible(candidate) && candidate.category === insight.category && !picked.includes(candidate))
  return [...picked, ...sameCategory].slice(0, limit)
}

export function insightsForService(href: string, limit = 3): Insight[] {
  return publishedInsights().filter((insight) => insight.relatedServices.includes(href)).slice(0, limit)
}

export function insightsForCaseStudy(slug: string, limit = 3): Insight[] {
  return publishedInsights().filter((insight) => insight.relatedCaseStudies.includes(slug)).slice(0, limit)
}

export function insightsByAuthor(founderSlug: string): Insight[] {
  return publishedInsights().filter((insight) => insight.authorSlug === founderSlug)
}

export function editorialPipeline(): Insight[] {
  return insights.filter((insight) => insight.status !== "published").sort((a, b) => a.brief.priority - b.brief.priority)
}
