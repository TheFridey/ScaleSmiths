/**
 * Reusable answers to questions buyers genuinely ask before commissioning work. Pages select the
 * questions relevant to their intent rather than repeating one block everywhere.
 *
 * Every answer must stay consistent with published evidence (data.ts, pricing claims, legal
 * terms). Answers marked `ownerReview` describe working practice and should be confirmed by the
 * founders before being expanded; see docs/content/seo-architecture.md.
 */

export interface LibraryFaq {
  q: string
  a: string
  ownerReview?: boolean
}

export const faqLibrary = {
  cost: {
    q: "How much does a website cost?",
    a: "It depends on scope, content, integrations and delivery risk, so every project receives a written proposal after discovery. Any current verified price guidance is published on the pricing page rather than quoted as a generic range.",
  },
  "outside-nottingham": {
    q: "Does ScaleSmiths work outside Nottingham?",
    a: "Yes. ScaleSmiths is based in Hucknall, Nottinghamshire and works with businesses across the UK. Published work also includes CSDS, a computer repair firm in Pennsylvania. Projects outside the area run remotely with a review cadence agreed in the scope.",
  },
  rebuilds: {
    q: "Do you rebuild existing websites?",
    a: "Yes. We start by reviewing what the current site already does well — pages that rank, enquiries it generates, integrations and hosting — and then recommend a rebuild, a focused repair or a migration, whichever the evidence supports.",
  },
  "seo-rebuild": {
    q: "Will we lose SEO rankings during a rebuild?",
    a: "Any rebuild carries some risk and nobody can honestly guarantee rankings. We reduce the risk by mapping existing URLs to their new equivalents with redirects, carrying over content that already performs, preserving metadata and structured data, and checking indexing after launch.",
    ownerReview: true,
  },
  support: {
    q: "Do you provide ongoing support after launch?",
    a: "Yes, through a Digital Growth Partnership. It can start after a ScaleSmiths build or with an existing website, and it covers agreed priorities rather than an open-ended retainer.",
  },
  "support-included": {
    q: "What is included in ongoing support?",
    a: "The proposal defines it. A Digital Growth Partnership can include hosting, updates, monitoring, fixes, SEO, conversion work, content, automation and roadmap delivery, with priorities and working cadence agreed up front.",
  },
  wordpress: {
    q: "Do you build WordPress websites?",
    a: "The websites and platforms in our published work are custom builds using technologies such as Next.js, React, Node.js and PostgreSQL rather than WordPress themes. If you already run WordPress, we look at what it is doing well before recommending whether a rebuild is justified.",
    ownerReview: true,
  },
  integrations: {
    q: "Can you integrate a website with our existing systems?",
    a: "Usually, yes. Published work includes a Salon Tracker booking integration and Google and Facebook review aggregation for Glow Tanning, and Stripe subscription billing with LiveKit video for The Business Circle. We check the existing system's API and data before committing to an approach.",
  },
  crm: {
    q: "Do you build CRMs?",
    a: "We build custom lead, quote and customer management tools where an off-the-shelf CRM does not fit the workflow — for example the quote management admin panel behind the CSDS website. If an existing CRM already does the job, connecting the website to it is often the better investment.",
    ownerReview: true,
  },
  timeline: {
    q: "How long does a typical project take?",
    a: "Timing is confirmed after discovery, because content readiness, integrations, review cycles and technical risk change the schedule more than page count does. The proposal records the delivery range and the assumptions behind it.",
  },
  phases: {
    q: "Can the work be delivered in phases?",
    a: "Yes. We separate the essential launch scope from later improvements, so the first release is dependable and further work follows evidence rather than a fixed wish list.",
  },
} as const satisfies Record<string, LibraryFaq>

export type FaqId = keyof typeof faqLibrary

export function libraryFaqs(ids: readonly FaqId[]): Array<{ q: string; a: string }> {
  return ids.map((id) => ({ q: faqLibrary[id].q, a: faqLibrary[id].a }))
}
