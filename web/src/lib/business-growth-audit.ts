export const businessGrowthAudit = {
  name: "ScaleSmiths Business Growth Audit",
  shortName: "Business Growth Audit",
  slug: "/services/business-growth-audit",
  startPath: "/services/business-growth-audit/start",
  priceMinor: 39_500,
  currency: "GBP",
  billingType: "one_time",
  buildCreditMinor: 39_500,
  active: true,
  deliveryCommitment: null,
  eligibleBuildRule: null,
  pillars: [
    { number: "01", title: "Positioning & trust", copy: "Offer clarity, differentiation, credibility, consistency and the reasons a prospect would choose you." },
    { number: "02", title: "Website & experience", copy: "First impression, hierarchy, mobile usability, performance, accessibility fundamentals, calls to action and technical friction." },
    { number: "03", title: "Customer journey & conversion", copy: "How discovery becomes trust, enquiry, response, quote or booking—and where valuable prospects disappear." },
    { number: "04", title: "Search & discoverability", copy: "Search intent, local visibility, site structure, landing opportunities and technical SEO fundamentals without ranking promises." },
    { number: "05", title: "Leads, follow-up & sales", copy: "Enquiry capture, response, qualification, quoting, booking and practical gaps in follow-up or tracking." },
    { number: "06", title: "Digital infrastructure", copy: "Hosting, domains, email, forms, analytics, integrations, reliability and fragmented provider responsibility." },
    { number: "07", title: "Operations & automation", copy: "Repeated administration, duplicate entry, weak handoffs and appropriate opportunities to connect or automate work." },
    { number: "08", title: "Growth opportunities", copy: "Quick wins, strategic moves, lower priorities and areas where spending more would not currently be justified." },
  ],
  deliverables: ["Executive summary", "Current position", "Evidence-backed findings", "Opportunity map", "Now / next / later priority roadmap", "Recommended actions", "Optional ScaleSmiths implementation route"],
  faq: [
    { q: "Is this just a website audit?", a: "No. The website is one part of a wider assessment covering positioning, customer journey, visibility, lead handling, digital infrastructure, operations and appropriate growth opportunities." },
    { q: "What do I receive?", a: "A structured ScaleSmiths assessment with an executive summary, current-position review, evidence-backed findings, opportunity map and a prioritised now, next and later roadmap." },
    { q: "What if I already know I need a new website?", a: "You can go directly into the project process. The Audit is most valuable when broader diagnosis will improve the decision or prevent investment in the wrong problem." },
    { q: "Do I have to use ScaleSmiths afterwards?", a: "No. The Audit is a standalone professional product. The findings and recommendations can be used internally or with another suitable provider." },
    { q: "What happens to the £395 if I commission ScaleSmiths?", a: "The full £395 Audit fee is credited against an eligible subsequent ScaleSmiths build. Eligibility is confirmed in the applicable project proposal so the rule is clear before commissioning." },
    { q: "Will you automatically recommend a rebuild?", a: "No. ScaleSmiths recommends fixing the actual constraint. That may involve content, follow-up, infrastructure, process improvements, focused changes, or no change where something already works." },
    { q: "Can ScaleSmiths implement the recommendations?", a: "Yes, where recommendations fall within ScaleSmiths services. Implementation is optional and separately scoped and quoted." },
  ],
} as const

export function formatAuditPrice(minor = businessGrowthAudit.priceMinor) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: businessGrowthAudit.currency, maximumFractionDigits: 0 }).format(minor / 100) }
export function buildBusinessGrowthAuditSchema(baseUrl = "https://scalesmiths.co.uk") {
  const base = baseUrl.replace(/\/$/, "")
  return [
    { "@context": "https://schema.org", "@type": "Service", name: businessGrowthAudit.name, description: "A business-wide assessment of digital presence, customer journey, systems and growth opportunities, delivered with a prioritised roadmap.", provider: { "@type": "Organization", name: "ScaleSmiths", url: base }, url: `${base}${businessGrowthAudit.slug}`, offers: { "@type": "Offer", price: businessGrowthAudit.priceMinor / 100, priceCurrency: businessGrowthAudit.currency, description: "One-time Business Growth Audit" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: businessGrowthAudit.faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ]
}
