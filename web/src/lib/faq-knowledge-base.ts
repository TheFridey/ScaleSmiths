import { faqEntries, type FaqId, type LibraryFaq } from "./faq-library"

/**
 * The browsable structure of /faq: which questions belong to which buyer topic, what each group
 * links out to, and the next action that makes sense after reading it.
 *
 * Answers live in faq-library.ts so the same wording can be reused in the contextual FAQ block
 * on a service, location or landing page. This file only decides grouping and onward routes.
 *
 * Deliberately no site-wide FAQPage schema: a sixty-question hub is not the "small set of
 * questions a page directly answers" that FAQ structured data is for, and Google restricts FAQ
 * rich results to authoritative health and government sources anyway. The per-page contextual
 * FAQ blocks, which are short and scoped to one intent, keep their existing schema.
 */

export interface FaqCategory {
  slug: string
  label: string
  /** Sentence shown under the category heading. */
  description: string
  questionIds: readonly FaqId[]
  /** Service routes worth reading after this group. Must exist in serviceRouteCatalogue(). */
  services: readonly string[]
  /** Published insight slugs worth reading after this group. */
  insights: readonly string[]
  cta: { href: string; label: string; description: string }
}

export const faqCategories: readonly FaqCategory[] = [
  {
    slug: "web-design",
    label: "Web design",
    description: "Cost, timescale, ownership, technology and what a website build actually involves.",
    questionIds: ["cost", "timeline", "website-ownership", "self-editing", "wordpress", "rebuilds", "hosting-provided", "website-migration", "project-inputs", "ecommerce-builds"],
    services: ["/web-design-nottingham", "/website-redesign-nottingham", "/e-commerce-development-nottingham"],
    insights: ["how-much-does-a-business-website-cost-uk-2026", "how-long-does-it-take-to-build-a-business-website", "custom-website-vs-wordpress-vs-wix"],
    cta: { href: "/quote", label: "Discuss a project", description: "Tell us where the current site falls short and what it needs to prove commercially." },
  },
  {
    slug: "seo",
    label: "SEO",
    description: "What search work involves, how long it takes, and what no agency can honestly promise.",
    questionIds: ["what-is-seo", "what-is-local-seo", "seo-timeline", "ranking-guarantees", "seo-in-build", "technical-seo", "seo-and-google-ads", "seo-existing-site", "not-on-google", "website-speed", "seo-rebuild"],
    services: ["/local-seo-nottingham", "/seo-website-audit", "/digital-growth-partnership"],
    insights: ["what-is-local-seo-and-do-you-need-it", "how-long-does-seo-take-local-business", "why-your-website-isnt-showing-on-google"],
    cta: { href: "/seo-website-audit", label: "Request an SEO and website audit", description: "Find out which of the three usual causes is actually holding the site back." },
  },
  {
    slug: "ongoing-support",
    label: "Ongoing support",
    description: "What happens after launch, what a Digital Growth Partnership covers, and where the boundaries sit.",
    questionIds: ["support", "support-included", "manage-external-site", "content-updates", "seo-ongoing", "something-breaks", "monitoring", "hosting-included", "request-priority", "new-features"],
    services: ["/digital-growth-partnership", "/website-maintenance-nottingham", "/managed-website-hosting"],
    insights: ["what-does-website-maintenance-include", "what-happens-when-your-website-goes-down"],
    cta: { href: "/digital-growth-partnership", label: "See how the partnership works", description: "How priorities, cadence and the commercial boundary are agreed before work starts." },
  },
  {
    slug: "custom-development",
    label: "Custom development",
    description: "CRMs, portals, integrations, automation and when custom software is genuinely justified.",
    questionIds: ["custom-web-development", "custom-software", "crm", "customer-portals", "stripe", "integrations", "process-automation", "replace-spreadsheets", "internal-admin-systems", "software-scaling", "phases"],
    services: ["/custom-software-development-uk", "/custom-web-app-development-uk", "/business-automation-nottingham", "/enterprise"],
    insights: ["what-is-a-web-application", "when-does-a-business-need-custom-software"],
    cta: { href: "/work", label: "View related work", description: "The systems behind these answers — CRMs, portals, billing and admin tooling in production." },
  },
  {
    slug: "infrastructure",
    label: "Infrastructure and email",
    description: "Business email, domain authentication, DNS, certificates, backups and where things are hosted.",
    questionIds: ["business-email", "spf", "dkim", "dmarc", "email-spam", "dns", "domains", "ssl", "backups", "hosting-location"],
    services: ["/services/managed-business-email", "/managed-website-hosting"],
    insights: ["spf-dkim-dmarc-explained", "why-business-emails-go-to-spam", "website-hosting-explained"],
    cta: { href: "/services/managed-business-email", label: "Explore Managed Business Email", description: "Custom-domain mailboxes with authentication configured and supported for you." },
  },
  {
    slug: "commercial",
    label: "Working together",
    description: "Pricing, payment terms, ownership, coverage and the kinds of business ScaleSmiths works with.",
    questionIds: ["project-pricing", "deposit", "outside-nottingham", "startups", "established-businesses", "unfinished-project", "code-ownership", "internal-team"],
    services: ["/pricing", "/services/business-growth-audit", "/services"],
    insights: ["why-cheap-websites-often-become-expensive", "signs-your-business-website-needs-rebuilding"],
    cta: { href: "/contact", label: "Ask a different question", description: "Anything not answered here goes straight to the founders." },
  },
]

export interface KnowledgeBaseFaq extends LibraryFaq {
  id: FaqId
  /** Stable anchor so an answer can be linked to directly. */
  anchor: string
  categorySlug: string
  categoryLabel: string
}

export function faqAnchor(id: FaqId): string {
  return `faq-${id}`
}

export function knowledgeBaseFaqs(): KnowledgeBaseFaq[] {
  return faqCategories.flatMap((category) =>
    category.questionIds.map((id) => ({
      ...faqEntries[id],
      id,
      anchor: faqAnchor(id),
      categorySlug: category.slug,
      categoryLabel: category.label,
    })),
  )
}

export function faqsForCategory(category: FaqCategory): KnowledgeBaseFaq[] {
  return category.questionIds.map((id) => ({
    ...faqEntries[id],
    id,
    anchor: faqAnchor(id),
    categorySlug: category.slug,
    categoryLabel: category.label,
  }))
}

/**
 * A contextual subset for a service, location or landing page: the same answers as the hub, each
 * carrying the anchor that deep-links it on /faq.
 */
export function contextualFaqs(ids: readonly FaqId[]): Array<{ id: FaqId; anchor: string; q: string; a: string }> {
  return ids.map((id) => ({ id, anchor: faqAnchor(id), q: faqEntries[id].q, a: faqEntries[id].a }))
}

/**
 * Which FAQ group an insight topic cluster belongs with, so an article hub can send a reader to
 * the short answers on the same subject. Keyed by InsightTopicSlug; the pairing is asserted in
 * faq-knowledge-base.test.ts rather than left to drift.
 */
export const FAQ_CATEGORY_FOR_INSIGHT_TOPIC: Record<string, string> = {
  websites: "web-design",
  seo: "seo",
  development: "custom-development",
  infrastructure: "infrastructure",
  enterprise: "custom-development",
}

/** The category an answer belongs to, so a page can deep-link to the right group on /faq. */
export function categorySlugForFaq(id: FaqId): string | undefined {
  return faqCategories.find((category) => (category.questionIds as readonly string[]).includes(id))?.slug
}

/**
 * The best hub anchor for a page showing several knowledge-base answers: the category most of
 * them belong to, so "browse the full FAQ" lands where the reader already is.
 */
export function faqHubHashFor(ids: readonly FaqId[]): string | undefined {
  const tally = new Map<string, number>()
  for (const id of ids) {
    const slug = categorySlugForFaq(id)
    if (slug) tally.set(slug, (tally.get(slug) ?? 0) + 1)
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** Every question, for the hub's client-side search. Lowercased text is precomputed once. */
export function faqSearchIndex(): Array<{ id: FaqId; haystack: string }> {
  return knowledgeBaseFaqs().map((faq) => ({ id: faq.id, haystack: `${faq.q} ${faq.a} ${faq.categoryLabel}`.toLowerCase() }))
}
