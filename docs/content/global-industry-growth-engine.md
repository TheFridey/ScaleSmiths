# ScaleSmiths Global Industry Growth Engine

**Status:** Phase 1 implementation — staged for founder review before production marketing claims freeze.  
**Directive:** `scalesmiths_global_industry_search_master_prompt` v1.0 (15 Oct 2026).  
**Owners:** Trev (commercial), Rhys (technical/production), Jarvis (execution).

## 1. Current-state audit (Phase 0)

### Live site (https://scalesmiths.co.uk, fetched Oct 2026)

| Finding | Detail |
| --- | --- |
| No `/industries` | `/industries`, `/industry`, `/sectors` returned 404 |
| Strong existing IA | Work, Insights, Services, Local Growth, Custom Systems, Quote, Portal intact |
| UK-anchored copy | Footer/contact previously “Serving businesses across the UK”; schema `areaServed` GB-centric |
| Pricing UI | Public fixed prices: Audit £395, Email £15/mo. Builds/partnerships “scoped after discovery” |
| Claims registry | Verified package figures exist for internal/claims use; industry pages do not retail build or retainer “from” prices |
| Proof already multi-sector | Confirm-A-Kill, Precision Finish, Foot Works, Glow Tanning, Pinkys Prints, SaaS platforms, CSDS (USA) |
| Sitemap | ~108 URLs; locality and journey SEO strong; no industry cluster |

### Repository

- Pattern to extend: typed registries (`landing-pages.ts`, `insights.ts`) → shared components → `public-sitemap.ts` → reciprocity tests.
- Interactive `/interactive` industries are **not** SEO pages; they remain experience simulations.
- Portal, quote security, middleware experience cookies, and claim-registry rules are protected.

### Protected elements (do not break)

Portal auth, quote rate limits/honeypot, verified claims pipeline, Nottingham/Hucknall landing SEO, case study URLs, legal pages, Forge/admin isolation.

## 2. Strategy & first 12 pages

Published specialist pages (meaningfully differentiated):

| Page | Hub | Proof |
| --- | --- | --- |
| Pest control | Trades | Direct — Confirm-A-Kill |
| Plastering & rendering | Trades | Direct — Precision Finish |
| Roofing | Trades | Adjacent — trades pattern |
| Electricians | Trades | Adjacent — trades pattern |
| Podiatry | Healthcare | Direct — Foot Works |
| Restaurants | Hospitality | Illustrative |
| Printing & signage | Media | Adjacent — Pinkys Prints |
| Independent retail | Retail | Direct — Pinkys Prints |
| Precision engineering | Manufacturing | Illustrative |
| B2B SaaS | Technology | Adjacent — Business Circle / Prymal |
| Beauty salons | Beauty | Direct — Glow Tanning |
| Accountants | Professional | Illustrative |

Prioritisation weights: existing authorised proof, pain intensity, ScaleSmiths capability fit, SEO distinctness, regulatory risk.

## 3. IA & URL map

```text
/industries/                                      Directory + search + A–Z
/industries/request/                              Missing-industry enquiry
/industries/[hub]/                               Vertical hub
/industries/[hub]/[industry]/                   Published specialist page only
```

- Filter/search is client-side; **no** indexable query-parameter industry URLs.
- Existing `/services/*`, locality landings, `/local-growth`, `/custom-systems` preserved.
- Locale prefixes deferred until genuine regional content exists.
- Soft global copy: `SERVICE_AREA_STATEMENT` updated to UK-based + international where viable. **No domain migration.**

## 4. Content registry

| Module | Role |
| --- | --- |
| `web/src/lib/industries/types.ts` | States, proof levels, page/hub shapes |
| `web/src/lib/industries/hubs.ts` | Vertical hubs |
| `web/src/lib/industries/pages.ts` | Published pages (routable only if `state: "published"`) |
| `web/src/lib/industries/taxonomy.ts` | Living candidate universe |
| `web/src/lib/industries/commercial.ts` | Build / Growth / Systems / Audit pathways |
| `web/src/lib/industries/registry.ts` | Search, A–Z, sitemap, schema, metadata |
| `web/src/lib/industries/attribution.ts` | Quote handoff without PII in URLs |

Publication states follow the directive: only `published` pages are routes + sitemap entries.

## 5. Commercial flows

| Pathway | Price on industry pages | Status |
| --- | --- | --- |
| Build | Scoped after discovery | No retail “from” price |
| Growth Partnership | Scoped after discovery | No retail retainer “from” price |
| Custom systems | Scoped after discovery | No fake “from” price |
| Audit | £395 | Matches live published product |

GBP remains the reference currency for published products and proposals. CTAs pre-attribute industry/hub/pathway into `/quote` briefs.

## 6. SEO / AEO

- SSR/static App Router pages with crawlable HTML, breadcrumbs, canonicals.
- JSON-LD: `CollectionPage` / `WebPage` / `Service` / `BreadcrumbList` / scoped `FAQPage` (no fake LocalBusiness, ratings, or invented offices).
- Sitemap auto-includes published industry URLs.
- Robots: no change to portal/API disallow; industry routes allowed.
- Bot policy (decision for founders): keep Googlebot/Bingbot discoverability; treat `OAI-SearchBot` as eligible for ChatGPT search if CDN allows; do **not** blindly open training crawlers. `llms.txt` remains optional documentation.

## 7. Growth operating manual (new industry)

1. Add/update candidate in `taxonomy.ts` (`state: researched`).
2. Write a content brief answering the 10 buyer questions from the directive.
3. Draft page in `pages.ts` with `state: draft` — fail the name-swap test.
4. Classify proof: direct / adjacent / illustrative; never invent testimonials.
5. Design against an existing presentation variant (`trades` | `clinic` | `hospitality` | `ecommerce` | `industrial` | `saas` | `professional`).
6. QA: metadata length, schema, internal links, mobile, forms with attribution.
7. Founder approval → `state: "published"`.
8. Deploy; verify sitemap + Search Console inspection.
9. 30/60/90: impressions, CTR, CTA rate, qualified enquiries — prune or refresh underperformers.

## 8. Commercial risk register

| Risk | Mitigation |
| --- | --- |
| Accidental reintroduction of build/retainer “from” prices | Industry commercial module keeps scoped routes `startingPriceLabel: null`; tests enforce it |
| Clinical / legal / financial advertising | Podiatry & accountants pages require conservative claims; professional-body review before aggressive copy |
| Case study permissions | Only link published Work; label adjacent/illustrative clearly |
| Thin page temptation | Tests enforce unique fingerprints, frictions, FAQs |
| Fake global presence | No city doorway pages; no invented offices |
| Homepage/nav regression | Industries added as additive nav/footer/home teaser; existing journeys untouched |

## 9. Deployment plan

1. Merge only after Rhys + Trev staged preview sign-off.
2. Roll out on existing `scalesmiths.co.uk` — no `.com` migration.
3. Monitor Search Console for new URLs; watch Core Web Vitals on industry templates.
4. Rollback: revert release; industry routes are additive (no destructive redirects of existing SEO URLs).

## 10. Honest completion status

| Deliverable | Status |
| --- | --- |
| Audit | Done (this doc + code comments) |
| Architecture + registry | Done |
| Directory + hubs + 12 pages | Done in code |
| SEO/schema/sitemap/nav/footer | Done |
| Enquiry attribution | Done (quote/strategy forms) |
| Unit tests | Done (`industries.test.ts`) |
| Mobile / E2E visual evidence | To capture in PR evidence after local preview |
| Build/retainer retail prices on industry pages | Closed — scoped delivery routes show no “from” prices |
| Search Console / Bing instrumentation | Ops follow-up post-deploy |
| Standalone “Global 9.5 Execution Directive” file | Not located in the repository, docs, or agent stores. This document and the October 2026 execution orders were used instead. |
| Workflow demonstrations | Four routes under `/industries/{hub}/experience` for trades, clinics and professional firms, manufacturing, and technology/commerce |
| Second specialist wave | 14 additional published pages. Further candidates stay unpublished until they are distinct |
| International delivery | `/international`. UK-founded, remote, GBP, no overseas offices. No hreflang |
| Phase 2 bulk (25 to 40 near-duplicate pages) | Not done. The directory still holds unpublished candidates |
