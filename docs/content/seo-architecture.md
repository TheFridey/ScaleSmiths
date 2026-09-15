# Search architecture and editorial standards

How ScaleSmiths organises commercial pages, case studies and founder-written insights so each page
owns one search intent, links to the evidence behind it, and nothing is published that the
founders could not prove to a prospective client.

## Entity

ScaleSmiths is a founder-led web development and digital growth company **based in Hucknall,
Nottinghamshire**, working with businesses across the UK. There is one address locality (Hucknall)
and no other offices. Nottingham pages describe working with Nottingham businesses *from* Hucknall;
they never imply a city-centre presence. The Organization, WebSite and founder Person entities are
declared once (`web/src/lib/structured-data.ts`); every other page references them by `@id`.

## Page ownership map

One page owns each intent. New pages must not target an intent already owned below.

| Intent | Owner | Notes |
| --- | --- | --- |
| Web design in Hucknall | `/web-design-hucknall` | Hucknall base, Hucknall case studies, face-to-face discovery |
| Web design in Nottingham (service businesses) | `/web-design-nottingham` | Service/area structure, rebuilds, Precision Finish evidence |
| Web development in Nottingham (integrations, admin, takeovers) | `/web-development-nottingham` | Not portals/SaaS — those belong to custom web apps |
| Custom web apps, portals, SaaS (UK) | `/custom-web-app-development-uk` | Product and portal intent |
| Next.js development (UK) | `/next-js-agency-uk` | Framework-led intent |
| Custom e-commerce | `/e-commerce-development-nottingham` | Only Pinkys Prints as proof; see cannibalisation |
| Local business growth (hub) | `/local-growth` | Journey hub linking to the local pages |
| Custom systems (hub) | `/custom-systems` | Journey hub linking to app, commerce and Next.js pages |
| Business growth audit | `/services/business-growth-audit` | Product page |
| Local growth audit | `/local-growth-check` | Local-intent landing page for the same audit; see cannibalisation |
| Pricing | `/pricing` | Scoping and verified guidance only |
| Case studies | `/work/<slug>` | Evidence pages; link to the service pages that cite them |
| Founder expertise | `/about/<founder>` + `/insights/<slug>` | Articles authored by the founder shown on the profile |

## Cannibalisation register

| Risk | Pages | Recommendation |
| --- | --- | --- |
| High | `/local-growth-check` vs `/services/business-growth-audit` | Same product and price. Keep the local page only if it is used for local campaigns; otherwise 301 to the audit page or set its canonical to it. |
| Medium | `/web-development-nottingham` vs `/custom-web-app-development-uk` vs `/custom-systems` | Repositioned: Nottingham development now owns integrations, admin and takeovers; portals/SaaS belong to the UK apps page. Keep examples distinct. |
| Medium | `/web-design-nottingham` vs `/web-design-hucknall` | Differentiated by locality evidence and angle (Hucknall base vs city-wide service-business structure). Revisit after 3 months of Search Console data; merge if Google treats them as one. |
| Medium | Build logs `/work/<log>` (~200 words each) | Thin indexable pages. Expand into founder articles, or add `noindex` until expanded. |
| Low | `/e-commerce-development-nottingham` | Nottingham in the slug with no Nottingham e-commerce proof. Keep the URL; add local commerce proof when available rather than more place-name copy. |
| Article | "Next.js vs WordPress" vs "Why we stopped recommending WordPress for complex platforms" | Publish the comparison first; fold the second in unless it has its own platform evidence. |
| Article | "Website rebuild SEO" vs "Keeping existing URLs during migration" | Rebuild article owns the broad query; the URL article must stay redirect-specific or become a section. |
| Article | "What makes a local site rank" vs "Technical SEO for local service businesses" | Strategy vs implementation. Merge if either would be thin. |

## Local page quality standard

A location page may exist only if it contains all of:

- what ScaleSmiths provides there, with problems and examples specific to that intent;
- verifiable local context (`localContext`) — never a paragraph shared with another page;
- at least one nearby or relevant case study;
- the founders and a clear contact route;
- page-specific FAQs plus relevant library FAQs;
- related services and, once published, related articles.

`landing-pages.test.ts` enforces unique titles, descriptions, H1s and body sentences (with place
and service names normalised, so name-swapped copy fails), title and description length, no
repeated place names in H1s, no banned superlatives, and local proof on location pages.

**Not created, deliberately:** `/seo-nottingham` (no measured SEO results to evidence it yet) and
`/software-development-nottingham` (would duplicate the custom web app and development pages).

## Internal link graph

- Case study → service pages: derived from each service page's curated `proofLinks`, so links are
  always reciprocal (`relatedServicesForCaseStudy`).
- Service/location page → case studies: `proofLinks`, rendered as image-led cards.
- Article → services, case studies, articles: `relatedServices`, `relatedCaseStudies`,
  `relatedInsights` in `web/src/lib/insights.ts`. Service routes are validated against
  `serviceRouteCatalogue()`.
- Service page / case study / founder profile → articles: derived from the article's relations,
  published articles only.

Links are placed in context (a related block after the relevant section), never as footer link
lists or automatic keyword links.

## Insights system

- Content lives in `web/src/lib/insights.ts` as typed blocks; links inside text use `[label](/path)`.
- Statuses: `planned` (brief only), `draft`, `published`. Only `published` is listed, linked,
  indexed or routable in production. `/insights` returns 404 until the first article is published.
- Authors are founders only. Byline, author card, `rel="author"` link and BlogPosting `author`
  share the founder's name, title (`authorTitle`) and profile `@id`.
- `authorNote` blocks are drafting instructions, shown in development only; tests block
  publication while any remain.

### Publishing checklist

1. Written by the named founder, in their own words.
2. Includes every item under `brief.firstHandEvidence` (or the brief is updated honestly).
3. No invented statistics, quotes, clients, awards or outcomes; results use verified claims.
4. `datePublished` set; `dateModified` updated on material changes.
5. Hero image (optional) is a real screenshot, photo or diagram with natural alt text.
6. Related services and case studies checked for relevance, not volume.
7. Status changed to `published`; run `npm test` and the build.

## FAQ answers needing founder confirmation

`web/src/lib/faq-library.ts` marks answers describing working practice with `ownerReview`:
rebuild SEO process, WordPress position and CRM approach. Confirm or edit them.

## Title and description rules

- Titles ≤ 60 characters, intent first, location only where the page is genuinely local,
  "ScaleSmiths" once.
- Descriptions ≤ 160 characters, specific about scope or evidence, no superlatives.
- Banned without objective verification: "#1", "best", "leading", "award-winning", "guaranteed
  rankings", "world-class", "cutting-edge".
