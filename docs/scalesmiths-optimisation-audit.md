# ScaleSmiths website optimisation audit

**Audit date:** 17 October 2026  
**Scope:** Public `web/` application and the live site at `https://scalesmiths.co.uk/`  
**Candidate branch:** `cursor/website-optimisation-3b79`

## Scope and constraints

This work targets mobile LCP, accessibility, privacy consent, conversion reassurance and regression coverage without replacing the established ScaleSmiths identity. The obsidian foundation, metallic gold and silver, forge imagery, cinematic desktop hero, Syne display type and ScaleSmiths emblem remain intact.

No testimonial, review score, certification, result, deliverable or price was invented. No authentication, portal, MFA, RBAC, migration, Forge or database control was weakened. No environment file or secret is included.

## Architecture and discovery

- `web/` is a Next.js 15 App Router application. The root layout owns global metadata, organisation/website JSON-LD, navigation, footer, consent UI and analytics.
- The normal homepage hero is assembled from `Hero`, `HeroForgeVideo` and `HeroEmbers`. The interactive Three.js experience remains a separate route and was not pulled into the normal homepage.
- Syne is self-hosted for the distinctive display treatment. Body copy previously also loaded a 344 KB Inter variable-font file.
- The hero previously used the desktop forge still as a CSS background on every viewport and could transfer the 496 KB forge video on mobile after intersection. The hero itself was a client component with Motion and resize/font-ready fitting work.
- Cookie choices are versioned and category-based. The banner exposes Reject, Manage and Accept controls; preferences can be reopened from the footer.
- Public enquiry routes include project brief, strategy/discovery call, enterprise, Business Growth Audit and managed email flows. The client portal remains private and `noindex`.
- Case-study and commercial sources of truth are typed data under `web/src/lib/`. Public pricing is centralised in `published-starting-prices.ts` and `business-growth-audit.ts`.
- The SEO foundation already includes route metadata, canonicals, `robots.txt`, sitemap generation, connected JSON-LD, `llms.txt`, API/discovery link headers and tests for indexability and internal links. Adding a second agent-discovery file or speculative schema would have created duplication rather than value.

## Verified findings

### Mobile LCP

Independent Lighthouse 13.5 inspection of the live mobile page identified the LCP element as the full-viewport forge atmosphere CSS background:

```text
section.hero-grid-bg > div.pointer-events-none
background-image: /brand/scalesmiths-forge-atmosphere.webp
```

The audit reported that the LCP resource was discoverable and eager, but did not have a high-priority fetch hint. The first viewport also carried avoidable font, hydration and media cost. The independently captured live mobile run scored 82 with a 4.60 s LCP and about 1,475 KiB transferred. That is better than the supplied PageSpeed reference of 70 / 6.2 s, but still below the requested mobile target.

### Accessibility

The live Lighthouse accessibility score was 93. Confirmed issues in the candidate included inaccessible hero text semantics and process copy whose opacity reduced contrast. The decorative headline treatment also did not need ARIA names on generic visual spans.

### Consent and analytics

Consent Mode was set to denied before a choice, but the Google tag script was still installed. A third-party request is itself optional processing; the safer boundary is to make no Google request until analytics is explicitly accepted. The mobile banner also occupied most of the first viewport.

### Conversion and trust

The primary CTA hierarchy was already coherent, but the first viewport and contact route did not explicitly explain the low-commitment consequence of submitting an enquiry. Published founder, company-registration, ICO, location, service and case-study proof already existed and was stronger than adding generic badge copy.

A public Trustpilot search on 17 October 2026 did not establish a verifiable ScaleSmiths company profile, rating or review corpus. No Trustpilot score, logo claim or testimonial has therefore been added.

## Implemented changes

### Performance

- Converted the normal hero shell to server-rendered markup and removed Motion/resize work from its critical path.
- Replaced the CSS LCP background with an explicit responsive `<picture>` and high-priority preload.
- Added `scalesmiths-forge-atmosphere-mobile.webp`, an approximately 20 KB mobile crop, while retaining the established forge treatment.
- Prevented the 496 KB hero video from loading below 768 px or for reduced-motion users. Desktop retains the deferred cinematic video.
- Removed the duplicate video poster transfer.
- Removed the 344 KB Inter variable-font transfer; body copy uses the existing platform UI stack while Syne remains self-hosted.
- Switched rendered logo marks to the existing WebP asset and removed a duplicate icon declaration.

The candidate LCP element is now the responsive mobile `<img>` with `fetchpriority="high"`, eager loading and intrinsic dimensions.

### Accessibility and consent

- Gave the hero one semantic screen-reader heading while treating the outlined visual lines as decorative.
- Removed low-opacity process states so copy keeps its intended contrast before intersection.
- Added an explicit consent summary relationship to the cookie dialog.
- Reduced the initial mobile banner footprint while preserving equal access to Reject non-essential, Manage preferences and Accept all.
- Kept optional categories off by default and deferred the GA4 script until explicit analytics consent.

### Conversion and enquiry

- Added concise first-viewport reassurance that an enquiry is founder-reviewed and neither takes payment nor creates a contract.
- Added a contact-page “What happens after you get in touch” panel explaining founder review, fit and next steps.
- Preserved the existing CTA hierarchy: discuss the business, inspect real work, submit a fuller brief when ready.
- Kept the direct email, founder profiles, enterprise route, Growth Audit route and existing-client portal visible.

### Trust and case studies

The current work IA was verified rather than filled with unsupported proof:

- Confirm-A-Kill remains the flagship end-to-end website, local search, analytics and operational-platform case study.
- Precision Finish and Glow Tanning remain published local-business build evidence.
- Foot Works is correctly described as optimisation of an existing Squarespace site and Jane App journey, not a ScaleSmiths rebuild.
- Outcome figures and customer quotations remain governed by verified claim records. No unverified “uplift” was introduced.

Regression coverage checks that work cards lead with imagery and scope, case studies expose client/starting point/build sections, service pages link to relevant proof, and the flagship remains responsive.

### Pricing and commercial clarity

Repository sources confirm these currently published figures:

| Offer | Verified public price |
| --- | ---: |
| Website design and development | From £2,000 |
| Growth Partnership | From £350/month |
| Business Growth Audit | £395 one time |
| Managed Business Email | From £15/month |
| Custom/enterprise systems | Scoped following discovery |

The existing copy already distinguishes a starting point from unlimited scope and records that Audit implementation is optional and separately scoped. No price or deliverable was changed in this overhaul.

### SEO and agent discovery

- Verified canonical metadata, crawlable public navigation, sitemap inclusion, robots controls and private-route exclusions.
- Added the indexable enterprise discovery route to the sitemap and covered that contract in the sitemap unit test.
- Tightened overlong metadata on enterprise, delivery, security, pricing, industries and enterprise-contact pages; shortened two overlong insight titles; expanded Foot Works' underspecified case-study description without changing its Squarespace scope.
- Verified one site-wide Organisation/ProfessionalService entity connected to WebSite, Person, Service, FAQ, Article and breadcrumb nodes where the visible page supports them.
- Verified `web/public/llms.txt` and HTTP discovery links already describe the public service and documentation surfaces.
- Removed duplicate icon metadata and retained the canonical production host.
- Added no aggregate-rating schema, fabricated review markup, doorway page or duplicate agent-discovery surface.

The final rendered crawl covered 133 pages with 0 errors and 0 orphan pages. Its 47 non-failing warnings comprise short directory/build-log or form surfaces, deliberate links to `noindex` conversion forms, low content-overlap candidates (20–27%), and one external client domain that did not answer the audit's HEAD request. Padding those pages or removing legitimate conversion links solely to reduce a warning count would be counterproductive.

## Performance comparison

Lighthouse 13.5 was run with headless Chrome using the standard mobile profile and the desktop preset. “Live before” is the deployed production URL. “Candidate after” is the local production build, so it validates the candidate and resource boundary but is not a claim about deployed production latency or field Core Web Vitals.

| Profile | Perf | FCP | LCP | TBT | CLS | Transfer | A11y | SEO | Best |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Supplied PageSpeed mobile reference | 70 | — | 6.2 s | — | — | — | 93 | — | — |
| Independently captured live mobile | 82 | 1.08 s | 4.60 s | 127 ms | 0 | 1,475 KiB | 93 | 100 | 100 |
| Candidate mobile, repeat range | 91–93 | 1.36 s | 3.24–3.41 s | 45–50 ms | 0 | 423–451 KiB | 100 | 100 | 100 |
| Independently captured live desktop | 99 | 0.30 s | 0.82 s | 10 ms | 0 | 1,507 KiB | 93 | 100 | 100 |
| Candidate desktop | 99 | 0.41 s | 0.83 s | 0 ms | 0 | 979 KiB | 100 | 100 | 100 |

The representative mobile candidate run improves Lighthouse performance from 82 to 93, reduces LCP by about 30%, and reduces transfer by about 71%. The supplied 6.2 s reference is reduced by about 48%. The 90+ performance aim is met in one repeat and narrowly missed in another; the synthetic LCP remains above 2.5 s, so deployment and production PageSpeed retesting are still required before calling the LCP target achieved.

## Buyer journeys

Automated Chromium checks covered:

- **A — Local business:** Home → Local Growth → Work → Strategy Call.
- **B — Website project:** Home → Services → Work → Project Brief.
- **C — Growth prospect:** Home → Growth Partnership → Business Growth Audit → Contact.
- **D — Enterprise:** Home → Enterprise → Delivery → Security → Strategy Call.

Additional checks cover Custom Systems → Work → Enterprise → Contact, existing-client portal routing, mobile CTA target size, mobile overflow, enquiry consent, campaign attribution without contact details in analytics, and the mobile no-video boundary.

## Visual evidence

Before/after captures are stored under `artifacts/website-optimisation/walkthrough/`:

- `homepage_desktop_before.png` / `homepage_desktop_after.png`
- `homepage_mobile_before.png` / `homepage_mobile_after.png`
- `mobile_navigation_before.png` / `mobile_navigation_after.png`
- `pricing_before.png` / `pricing_after.png`
- `case_study_before.png` / `case_study_after.png`
- `contact_before.png` / `contact_after.png`
- `cookie_consent_before.png` / `cookie_consent_after.png`

The captures show the retained brand treatment, responsive navigation and published commercial/case-study content as well as the reduced consent footprint and added reassurance.

## Validation

Completed successfully:

- `npm run lint`
- `npm exec tsc -- --noEmit`
- `npm run build`
- 30 focused Vitest checks for consent, hero contrast, pricing, structured data and public discovery
- 60 focused SEO/content unit checks after the crawl corrections
- 44 targeted Chromium E2E checks across accessibility, consent, enquiries, pricing, buyer journeys, technical SEO, trust and case studies
- 9 final buyer-journey/mobile-hero checks
- 6 contact/trust checks after adding the reassurance assertion
- 13 final technical-SEO, pricing and case-study browser checks
- 9 Linux visual-regression checks across desktop, tablet and mobile
- `npm run check:performance-budgets`, five public archetypes passed with no hard failures or advisory warnings
- full rendered SEO crawl, 133 pages, 0 errors and 0 orphans
- `npm run check:env-hygiene`
- `npm run check:dependency-governance`
- `npm run check:documentation-links`
- `npm run check:local-state-hygiene`

The first targeted Playwright attempt failed because the runner lacked its FFmpeg binary; after installing the Playwright runtime asset, the same 44 tests passed. This was environment setup, not an application regression.

## Outstanding dependencies and residual risk

- Deploy the candidate and rerun mobile PageSpeed/Lighthouse against production. Local production results do not include production CDN, network, cache and server behaviour.
- Review CrUX/Search Console Core Web Vitals after sufficient field data accumulates; a single synthetic run cannot establish user-experienced LCP.
- The <2.5 s synthetic mobile LCP target is not yet met. If production repeats remain above it, inspect production TTFB/cache headers and test a still with fewer full-viewport painted pixels before changing the established cinematic composition.
- Keep the desktop video under observation on data-saver and lower-powered devices; mobile and reduced-motion users already receive the still-only treatment.
- Do not publish Trustpilot proof until a genuine ScaleSmiths profile and its public review data can be verified.
- New customer quotes, outcomes or logos still require client approval and evidence before publication.
- `https://csdshome.com` did not answer the crawler's external HEAD check. Confirm the client domain's current public status before changing or removing the authentic portfolio link.
- No database-backed portal lifecycle or infrastructure suite was needed for these public presentation changes.

## Commercial recommendations

1. Measure completed enquiry routes and qualified outcomes by landing/service path using the existing consent-aware, no-contact-data analytics boundary.
2. Seek explicit client approval for concise case-study quotations and measurable outcomes. Add them only through the existing verified-claims mechanism.
3. Keep the published starting-price source centralised; update copy, schema and tests together whenever founders approve a commercial change.
4. Review the Growth Partnership entry point against actual delivery scope periodically, without implying an unlimited retainer.
5. Use real Search Console and enquiry evidence to choose the next content/internal-link priorities instead of multiplying location or “AEO” pages.
6. Revisit third-party review presentation only when the business profile is verifiable and the rating/count can be kept current.
