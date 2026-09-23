# ScaleSmiths SEO architecture

This document describes the implemented technical SEO system in the public Next.js application under `web/`. It complements the editorial intent and cannibalisation register in `docs/content/seo-architecture.md`.

## Metadata

`web/src/lib/page-metadata.ts` is the canonical page metadata builder. It produces a unique title, description, self-referencing canonical, Open Graph data, X card and social image. Article inputs additionally support authors, publication and modification dates, and section names. The root layout supplies `metadataBase`, the ScaleSmiths title template and safe crawler defaults.

Every indexable page must call the builder directly or use a domain helper that calls it, such as `metadataForLandingPage`, `metadataForServiceJourney`, `founderProfileMetadata` or `insightCategoryMetadata`. Completion, authentication and private portal routes remain `noindex`.

Canonical paths are root-relative and are resolved against `https://scalesmiths.co.uk` (or the explicitly configured production site URL). Canonicals never include request query strings.

## Sitemap and robots

`web/src/app/sitemap.ts` delegates to `web/src/lib/public-sitemap.ts`. The sitemap is assembled from the actual landing-page, founder, case-study, legal and published-Insight registries. New registered content is included automatically. Draft or planned Insights, private portal routes, APIs, forms and completion pages are excluded.

`web/src/app/robots.ts` permits public pages and rendering assets while disallowing APIs, the private portal and non-indexable conversion-completion routes. It publishes the canonical host and sitemap URL.

## Structured data

`web/src/lib/structured-data.ts` owns reusable Organization, WebSite, WebPage, CollectionPage, FAQPage, Person, ProfilePage, BlogPosting, Article and BreadcrumbList builders. `web/src/components/JsonLd.tsx` serialises schema safely. Page nodes reference the site-wide Organization and WebSite IDs instead of redefining inconsistent entities.

Only repository-supported facts are published. Do not add ratings, reviews, awards, qualifications, employee counts, performance claims, addresses or identifiers without approved evidence.

## Content and authors

Founder data lives in `web/src/lib/founders.ts`. It supplies the author name, role, biography summary, image key, expertise, profile URL and verified project relationships. Article bylines, author cards, metadata and Person schema resolve from the same record.

The Insights model and selectors live in `web/src/lib/insights.ts`; the initial published library lives in `web/src/lib/insight-library.ts`. Articles use safe typed blocks rather than raw HTML and support SEO titles, descriptions, founder authors, dates, optional project imagery, table-of-contents headings, callouts and curated service, Work and article relationships. Only published content is routable, internally linked, included in RSS or included in the sitemap. The `/insights` hub and these topic clusters are generated from the registry:

- `/insights/websites`
- `/insights/seo`
- `/insights/growth`
- `/insights/development`
- `/insights/automation`
- `/insights/infrastructure`

Never publish a planning brief as an article. Published articles require a real founder, dates, first-hand evidence and no drafting notes.

`/feed.xml` is generated from the same published registry, so RSS and the sitemap cannot acquire draft-only URLs independently. Article metadata and BlogPosting schema resolve the same founder record used by the visible byline and profile card.

## Internal linking and breadcrumbs

`Breadcrumbs` provides the accessible visual trail; `buildBreadcrumbSchema` provides the matching machine-readable trail. Deep content follows Services, Insights, Work and About hierarchies.

Reusable related-content components are `RelatedInsights`, `RelatedServices`, `RelatedWork`, `RelatedQuestions` and `NextRecommendedArticle`. Existing domain selectors keep reciprocal links factual: case studies derive related services from the pages that cite them, and Insights declare reviewed service/work/article relationships.

A case study may also curate its topic cluster through `relatedServiceHrefs` and `relatedInsightSlugs` in `data.ts`, which put the most relevant routes first without replacing the derived set. The reciprocity rule still holds and is enforced in `case-studies.test.ts`: a case study only links to a service page that lists it as proof. `adjacentCaseStudies` gives every case study a previous/next route so no project is a dead end.

`tests/e2e/internal-link-graph.spec.ts` is the site-wide audit. It crawls the public site from the homepage and fails on dead internal links, sitemap routes nothing links to, sitemap routes the crawl never reaches, duplicate element ids, missing or duplicated metadata, broken heading order and console errors. `/interactive` and `/traditional` are the only routes exempt, because they are reached through the experience chooser rather than a standing link. The same file checks that each major search entry point has no horizontal overflow at 390px and offers a conversion route in its own content rather than relying on the header and footer.

## FAQ knowledge base

`web/src/lib/faq-library.ts` holds every published answer, keyed by a stable id. `faq-knowledge-base.ts` groups those ids into the six buyer categories rendered on `/faq`, and records the service routes, insight slugs and next action that belong with each group.

One answer is written once and reused. `/faq` renders the whole library through the `FaqKnowledgeBase` client component (category navigation, text search, native `<details>` disclosure, `#faq-<id>` deep links). Service, landing, journey and location pages render a scoped subset through the `ContextualFaqs` server component, which always links back to the relevant hub category. Both read the same records, so a corrected answer changes everywhere at once.

`/faq` deliberately emits `CollectionPage` and `BreadcrumbList` schema, **not** `FAQPage`. Marking up sixty questions as one FAQ entity is not what the schema describes, and Google restricts FAQ rich results to authoritative health and government sources — there is no result to chase. Short, intent-scoped FAQ blocks on individual service pages keep their existing `FAQPage` markup, because there the questions genuinely are what the page answers.

Answers must stay consistent with published evidence: `data.ts`, verified public claims, `managed-business-email.ts` and `legal-policies.ts`. Where practice is agreed per engagement rather than published — payment terms, response commitments, what a given partnership covers — the answer says so and routes to contact. `faq-knowledge-base.test.ts` enforces category coverage, unique anchors, live service routes, published insight slugs and the no-ranking-promise rule.

## Adding content

Commercial service pages are registered in `web/src/lib/landing-pages.ts`. The shared `LandingPage` component renders buyer problems, included work, delivery process, commercial considerations, factual case-study proof, FAQs, related services and conversion paths. Keep one canonical route per intent; strengthen an existing record instead of creating a second URL with equivalent meaning.

Genuine location hubs are registered in `web/src/lib/location-pages.ts` and rendered by `LocationPage`. A location record needs distinct local context, relevant services and nearby evidence. The initial `/locations/nottingham` regional hub and `/locations/hucknall` home-base page deliberately serve different reader needs.

1. Add the content to its typed source registry rather than hard-coding sitemap entries in a component.
2. Give the page a unique title and description through the metadata builder.
3. Add a self-referencing canonical path without a trailing slash or query string.
4. Render one descriptive H1 and a visual breadcrumb on deep routes.
5. Add only the schema type that matches visible content.
6. Add contextual links to relevant service, evidence and author pages.
7. Supply truthful image alt text and dimensions; use `next/image` with responsive `sizes`.
8. Run unit tests, lint, `npm exec tsc -- --noEmit`, production build and the SEO Playwright crawl.

For a new Insight, set the status to `published` only after the founder has written and approved it. For a new location page, meet the distinct local-evidence standard in `docs/content/seo-architecture.md`; do not clone a page and swap place names.
