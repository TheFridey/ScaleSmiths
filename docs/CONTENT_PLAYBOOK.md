# ScaleSmiths content playbook

How to add an Insight article, an FAQ answer, a case study or a commercial page — and how to
write so the result sounds like ScaleSmiths rather than like an agency blog.

Everything on the public site is typed data in `web/src/lib/`, not Markdown files. That is
deliberate: a typed registry cannot ship a broken link, an unknown author, a missing category or
an unpublished article in the sitemap, because the tests check those relationships.

---

## 1. Adding an Insight article

Articles live in `web/src/lib/insight-library.ts` as entries in the `seeds` array. Each seed is
expanded by the `article()` factory into a full `Insight` record, so you write the content and
the factory builds the body, schema, brief and reading time.

### The fields

| Field | Required | Rule |
| --- | --- | --- |
| `slug` | yes | Lower-case, hyphenated, no dates, no stop-word padding. It is the URL and it never changes once published. |
| `title` | yes | The on-page H1. Write it as the question or claim a reader would recognise. |
| `seoTitle` | no | Only when the H1 is too long or too conversational for a search result. Keep under 60 characters; the layout appends ` \| ScaleSmiths`. |
| `description` | yes | 70–160 characters. A real summary, not a teaser. This is the meta description and the card copy. |
| `category` | yes | One of the `InsightCategory` keys in `insights.ts`. The category decides which topic cluster page the article appears on. |
| `answer` | yes | The opening paragraph. Answer the title's question in the first two sentences. No throat-clearing. |
| `sections` | yes | `[heading, body]` pairs. Three to six. Each heading is a real sub-question, not a label like "Overview". |
| `takeaways` | yes | The "A practical way to decide" list. Decisions a reader can act on, not a summary of what they just read. |
| `callout` | yes | `[title, text]`. One concrete ScaleSmiths point — what we do, what we would look at, what we would refuse to promise. |
| `services` | yes | Service route hrefs. Must exist in `serviceRouteCatalogue()`; the test fails otherwise. |
| `work` | no | Case study slugs the article genuinely draws on. Drives "Work referenced in this article" and the case-study back-link. |
| `related` | no | Other article slugs. Omit and the topic cluster fills in siblings automatically. |
| `author` | no | `rhys` or `trevor-newton-bradley`. Defaults to `rhys`. Set it to whoever actually wrote it. |
| `published` | no | ISO date. Defaults to the library's current publication date. **Set this explicitly for anything added from now on.** |
| `updated` | no | ISO date of the last substantive revision. Defaults to `published`. |
| `featured` | no | At most one article at a time. It takes the hero slot on `/insights`. |
| `heroImage` | no | `{ src, alt, width, height }`. Only a real image that exists in `public/`. |

### Worked example

```ts
{
  slug: "how-long-should-a-website-rebuild-take",
  title: "How Long Should a Website Rebuild Take?",
  seoTitle: "Website Rebuild Timescales (UK, 2026)",
  description:
    "What actually sets the schedule on a website rebuild — content readiness, integrations and review cycles — and why page count is the least useful estimate.",
  category: "commercial",
  answer:
    "Most rebuilds are held up by content and decisions, not by build time. A five-page site with unwritten copy and three stakeholders takes longer than a twenty-page site with finished content and one decision-maker.",
  sections: [
    ["What sets the schedule", "…"],
    ["Where rebuilds actually stall", "…"],
    ["What you can do to shorten it", "…"],
  ],
  takeaways: [
    "Write the content before the build starts, not alongside it.",
    "Name one person who can approve a page without a meeting.",
    "Get access to hosting, DNS and analytics agreed in week one.",
  ],
  callout: [
    "How we scope it",
    "The proposal records a delivery range and the assumptions behind it, so a slipped date can be traced to a specific decision rather than absorbed quietly.",
  ],
  services: ["/website-redesign-nottingham", "/web-design-nottingham"],
  work: ["confirm-a-kill"],
  author: "rhys",
  published: "2026-10-14",
}
```

### After adding it

The article automatically appears in the Insights index, its topic cluster page, the author's
profile, related-content components, `sitemap.xml` and `/feed.xml`. Nothing else to wire up.

Run `npx vitest run` — the tests check the slug is unique, the author exists, every service href
resolves, every case study slug exists, and that nothing unpublished reaches the sitemap.

---

## 2. Adding an FAQ answer

Answers live in `web/src/lib/faq-library.ts`, keyed by a stable id. The id becomes the `#faq-<id>`
anchor on `/faq` and never changes once published.

```ts
"do-you-offer-training": {
  q: "Do you provide training when the site launches?",
  a: "Handover covers whatever you will actually be responsible for…",
  services: ["/services", "/digital-growth-partnership"],
  insights: ["what-does-website-maintenance-include"],
},
```

Then add the id to exactly one category in `web/src/lib/faq-knowledge-base.ts`. The test fails if
an answer belongs to no category or to two.

To surface the answer on a service page, add its id to that page's `faqLibrary` array in
`landing-pages.ts`, `service-journeys.ts` or `location-pages.ts`. One answer, written once, reused
everywhere — never copy the text.

**The honesty rule.** If ScaleSmiths has not decided something, or it is agreed per engagement,
say so and route to contact. Payment terms, response commitments and what a specific partnership
covers are all in that category. Never invent a policy to fill a gap.

---

## 3. Adding a case study

Projects live in `web/src/lib/data.ts`. The fields that matter for depth: `client`, `services`,
`startingPoint`, `strategy`, `solution`, `features`, `technicalImplementation`,
`relatedServiceHrefs`, `relatedInsightSlugs`.

Two hard rules, both enforced by tests:

1. **Numbers need a verified public claim.** Rankings, traffic, conversion and revenue figures
   come through `outcomeClaimIds` / `metrics` and the claim registry, never inline prose. If there
   is no evidence, describe the delivered scope instead.
2. **A case study only links to a service page that cites it as proof.** Add the slug to that
   page's `proofLinks` first, or the reciprocity test fails.

Testimonials require a client-approved `quoteClaimId`. There is no other route to publishing one.

---

## 4. House style

Write the way the founders talk to a client who is paying attention.

**Do**

- Answer the question in the first two sentences.
- Prefer the specific to the general: "a Salon Tracker booking integration", not "third-party
  integrations".
- Say what you would not promise, and why. It is the most credible thing on the page.
- Use British English: optimise, organisation, licence (noun), behaviour, whilst → while.
- Use real numbers when they exist and are evidenced, and say what period they cover.
- Keep sentences short enough to read aloud without running out of breath.

**Don't**

- Open with "In today's digital landscape", "In the modern era", or any variation. Start with the
  answer.
- Use em dashes as a default connector. One per few paragraphs at most; a full stop is usually
  better.
- Reach for "leverage", "synergy", "seamless", "cutting-edge", "robust solutions", "digital
  transformation journey", "unlock", "supercharge", "game-changing", "best-in-class".
- Pad with three-item lists when two items or a sentence would do. The pattern becomes obvious
  when every section has exactly three of everything.
- Write a conclusion that restates the article. End on the decision the reader now has to make.
- Repeat a phrase across articles. If two pieces open the same way, one of them is wrong.
- Claim expertise, awards or certifications. State what was built and let it stand.

**Length.** Long enough to answer the question properly, short enough that nothing is filler.
Most of the library sits between 700 and 1,200 words. A thin page is a liability; a padded one is
worse, because it hides the answer.

---

## 5. Before publishing

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
npm run seo:audit -- --base http://127.0.0.1:3000   # against a running server
```

The audit writes `docs/seo-audit.json` and `docs/SEO_FINAL_AUDIT.md`. Zero errors is the standard;
warnings need a decision, not necessarily a change.

Check the new page's shingle overlap in the audit's "closest content pairs" table. If a new
article overlaps an existing one by more than roughly 40%, the two are competing for the same
query — merge them or sharpen the intent of one.
