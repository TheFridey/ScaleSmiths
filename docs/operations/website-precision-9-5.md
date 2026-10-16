# Website precision pass: implementation report

This report covers the public website changes on branch `cursor/precision-9-5-standard-bce7`. It distinguishes work that was implemented and checked from recommendations, unverified items, and decisions still waiting on the founders.

The live site at https://scalesmiths.co.uk was not deployed from this branch. Production verification below is a comparison against the current live homepage, plus checks of the local Next.js server for this branch.

## A. Completed improvements

- The homepage now leads with who ScaleSmiths helps, the commercial promise, and a conversation. Starting prices remain on the page, after the problems and the three buyer routes.
- Published prices are unchanged: websites from £2,000, Growth Partnerships from £350/month, the Business Growth Audit at £395, and business email from £15/month.
- Customer-facing editorial instructions were removed from the published industry pages, the industry request page, the homepage proof note, and the enterprise enquiry close.
- Confirm-A-Kill now opens with a six-part reading guide: challenge, work, improvement, evidence, limitations, and the continuing opportunity. The measured baseline is unchanged.
- The footer, privacy notice, website terms, and organisation structured data now publish the verified company and ICO registrations as separate facts.
- Strategy-call enquiries can include an optional business type. Enquiry completions for the strategy call and the project brief now record a funnel type in the existing analytics metadata.
- Pricing is linked from the services menu.
- Reduced-motion preferences no longer change the first render of the hero video, embers, or motion components, which was causing a hydration mismatch. CSS still stops the video and the ember animation when reduced motion is requested.
- The cookie panel is slightly tighter on small screens. The choices and the explanation are unchanged.

## B. Pricing positioning

Recommended presentation, now implemented in the page order:

1. State the commercial promise and the three kinds of buyer.
2. Show the problems and the route that fits.
3. Then show the four published starting prices, with a sentence that a low starting price is not the size of the company and is not a ceiling.
4. Keep the same figures on the pricing page and on the service pages that own them.

No amount was changed. No price was removed from the homepage. Complex projects are still described as scoped, not given an invented premium tier.

Founder review still applies to two items:

- Whether the homepage should keep all four starting prices this far down the page, or move them back up.
- The Confirm-A-Kill case study still states that this client's Growth Partnership is £350 per month. That figure was already public. It has not been removed. It is specific to that agreement, and the page says other partnerships are quoted separately. If the client has not agreed to that fee being public, it should be taken down in a separate approved edit.

## C. Content corrections

Removed or rewritten where a visitor could read them:

- "We do not invent testimonials, rankings or overseas client results."
- "Publish only verified outcomes and permissioned assets."
- "without inventing local offices" and "without inventing certifications."
- "Trust without inventing badges."
- "Editorial review discipline: no invented results."
- "We do not scrape or invent scheme memberships."
- "that demand shapes the backlog."
- "This enquiry route is ready for a dedicated enterprise form."
- "No invented certifications, logos or guaranteed compliance claims."

Industry substance, proof labels, and the honest limits on case-study results were kept. Illustrative industries still say they are not a claimed delivery.

## D. Visual presentation

Checked in Chromium at 1440×900 and 390×844 against the local dev server, with reduced motion enabled.

After a consent choice, the mobile and desktop heroes show the brand line, "More customers. Less wasted time.", who the company helps, and both calls to action, with no horizontal overflow.

The first visit still opens on the cookie panel. That panel is required. On a phone it covers the lower part of the hero until the visitor chooses. The explanation and the three choices remain.

Screenshots from this review are stored with the pull request.

## E. Conversion journey

Checked on the local server:

- Homepage primary action goes to the strategy-call brief.
- Homepage secondary action goes to the work index, so the first button is no longer "See starting prices".
- Services menu includes Pricing.
- Industry, enterprise, case study, and pricing routes render.
- The strategy-call form rejects an empty submit with "Please add your name."
- The form asks, optionally, what kind of business it is. Name, business name, the problem, preferred contact, timing, and consent stay required.
- Mobile form layout does not overflow.

Not verified:

- A real enquiry email was not sent. This environment has no Resend configuration, and a test submission was not posted to production.
- Server-side validation is covered by the existing quote security unit tests. It was not exercised against a live database in this pass.
- Purchase of the Business Growth Audit was not completed. The public flow is still a request, not a card payment. The page still states that no payment is taken on the website.

## F. Technical SEO

Local `robots.txt` allows `/` and points at the sitemap. Thanks pages and portal routes stay disallowed.

Local `/sitemap.xml` returned 131 unique URLs. That is the generated inventory for this branch. It is not a Search Console index report. Being in the sitemap does not prove Google has indexed the URL.

Breakdown:

- 24 other public routes, including the homepage, services, pricing, contact, and location landing pages
- 23 industry URLs
- 41 insight URLs
- 16 work URLs
- 16 legal URLs
- 3 location URLs
- 3 about URLs
- 3 service URLs
- 2 enterprise URLs

Organisation structured data now includes the legal name ScaleSmiths Ltd, the Companies House number, and the ICO registration number as separate identifiers. It does not include a VAT number, a telephone number, a founding date, ratings, or reviews.

No new doorway pages were added. Existing URLs were not renamed.

## G. Performance

Core Web Vitals were not measured on a production build or on real users in this pass. A Lighthouse run against the development server would not be a valid before-and-after result, so none is claimed.

The existing performance budget in the repository allows a laboratory Largest Contentful Paint up to 4.2 seconds before it fails, with an advisory target of 2.8 seconds. That is looser than the 2.5 second objective. This pass did not change image pipelines, fonts, or the hero video loading strategy, apart from not attaching the video source when reduced motion is set.

Largest Contentful Paint, Interaction to Next Paint, and Cumulative Layout Shift on real users: unverified.

## H. Trust and legal disclosures

Checked against the public registers on 16 October 2026.

Companies House company 17496624 is SCALESMITHS LTD, an active private limited company, incorporated on 2 October 2026. Registered office: 27 Belle Isle Road, Nottingham, NG15 7JL. SIC 74100.

ICO registration ZC265402 is Scalesmiths Ltd, registered 3 October 2026, expiring 2 October 2027, Tier 1, data controller, at the same address.

These are different registers. The privacy notice says the ICO number is a data-controller registration, not an approval, certification, or endorsement.

VAT registration was not on the records checked. No VAT number is published. That remains an open decision for Rhys.

The incorporation date is not used as a "founded" date in marketing or structured data. The trading history and the company registration date are not the same claim.

## I. Quality assessment

These scores are a review of this branch, not a claim that the live site is already at this standard. 9.5 was not awarded where the evidence does not support it.

| Category | Score | Basis |
| --- | --- | --- |
| Premium brand impression | 8.5 | Forge identity and typography are intact. The commercial line is readable. The first mobile visit is still dominated by the cookie choice. |
| Commercial messaging | 8.5 | The opening copy names the buyers and the problems. The page is still long. |
| Trust and credibility | 8.5 | Company and ICO facts are verified and separated. Case-study limits remain. VAT is unpublished. |
| Homepage clarity | 8.5 | After consent, a new visitor can see who is helped, the promise, and the next step without scrolling on a phone. |
| Pricing positioning | 8.0 | Order is improved and amounts are unchanged. The £15 email price is still on the homepage, which is honest and still an anchor. Founder placement review is open. |
| Industry-specific content | 8.0 | The 12 published pages no longer expose the editorial instructions found in review. They still share one template. |
| Enterprise positioning | 8.5 | Founder-led delivery is explicit. Team size is not inflated. The page was already a strength. |
| Customer navigation | 8.5 | Pricing is in the services menu. Existing URLs are unchanged. |
| Conversion journey quality | 7.5 | Client validation and the brief fields were checked. Live email delivery was not. |
| Mobile user experience | 8.0 | No horizontal overflow on the routes checked. Touch targets on the cookie actions stay at least 44px. The consent panel still covers the first mobile screen. |
| Technical SEO foundations | 8.5 | Sitemap, robots, canonicals, and organisation identity are in place in code. Indexation is unverified. |
| Technical performance | unverified | No production or field measurement in this pass. |
| Accessibility | unverified | Reduced-motion hydration was fixed and checked. A full WCAG 2.2 AA audit was not run. |

## J. Production verification

- Branch: `cursor/precision-9-5-standard-bce7`
- Base: `master`
- Deployment: not deployed. The live site was only used as the before screenshot.
- Web unit tests: 386 passed, including the follow-up hero contrast test.
- `tsc --noEmit`: passed.
- ESLint on the changed files: passed.
- Local route checks: homepage, pest-control industry, enterprise, Confirm-A-Kill, pricing, strategy-call form, and the industry request page rendered without console errors.
- Rollback: revert this pull request. No migration, environment variable, or infrastructure change is included.

## Sitemap URLs generated by this branch

- https://scalesmiths.co.uk
- https://scalesmiths.co.uk/about
- https://scalesmiths.co.uk/about/rhys
- https://scalesmiths.co.uk/about/trevor-newton-bradley
- https://scalesmiths.co.uk/business-automation-nottingham
- https://scalesmiths.co.uk/contact
- https://scalesmiths.co.uk/custom-software-development-uk
- https://scalesmiths.co.uk/custom-systems
- https://scalesmiths.co.uk/custom-web-app-development-uk
- https://scalesmiths.co.uk/digital-growth-partnership
- https://scalesmiths.co.uk/e-commerce-development-nottingham
- https://scalesmiths.co.uk/enterprise
- https://scalesmiths.co.uk/enterprise/delivery
- https://scalesmiths.co.uk/faq
- https://scalesmiths.co.uk/industries
- https://scalesmiths.co.uk/industries/fitness-beauty-personal-care
- https://scalesmiths.co.uk/industries/fitness-beauty-personal-care/beauty-salons
- https://scalesmiths.co.uk/industries/healthcare-wellness
- https://scalesmiths.co.uk/industries/healthcare-wellness/podiatry
- https://scalesmiths.co.uk/industries/hospitality-experiences
- https://scalesmiths.co.uk/industries/hospitality-experiences/restaurants
- https://scalesmiths.co.uk/industries/manufacturing-industrial
- https://scalesmiths.co.uk/industries/manufacturing-industrial/precision-engineering
- https://scalesmiths.co.uk/industries/media-creative
- https://scalesmiths.co.uk/industries/media-creative/printing-signage
- https://scalesmiths.co.uk/industries/professional-services
- https://scalesmiths.co.uk/industries/professional-services/accountants
- https://scalesmiths.co.uk/industries/request
- https://scalesmiths.co.uk/industries/retail-ecommerce
- https://scalesmiths.co.uk/industries/retail-ecommerce/independent-retail
- https://scalesmiths.co.uk/industries/technology-software
- https://scalesmiths.co.uk/industries/technology-software/b2b-saas
- https://scalesmiths.co.uk/industries/trades-home-services
- https://scalesmiths.co.uk/industries/trades-home-services/electricians
- https://scalesmiths.co.uk/industries/trades-home-services/pest-control
- https://scalesmiths.co.uk/industries/trades-home-services/plastering-rendering
- https://scalesmiths.co.uk/industries/trades-home-services/roofing
- https://scalesmiths.co.uk/insights
- https://scalesmiths.co.uk/insights/custom-website-vs-wordpress-vs-wix
- https://scalesmiths.co.uk/insights/designing-audit-trails-operational-software
- https://scalesmiths.co.uk/insights/development
- https://scalesmiths.co.uk/insights/does-website-speed-affect-seo
- https://scalesmiths.co.uk/insights/enterprise
- https://scalesmiths.co.uk/insights/enterprise-software-modular-monolith
- https://scalesmiths.co.uk/insights/how-long-does-it-take-to-build-a-business-website
- https://scalesmiths.co.uk/insights/how-long-does-seo-take-local-business
- https://scalesmiths.co.uk/insights/how-much-does-a-business-website-cost-uk-2026
- https://scalesmiths.co.uk/insights/how-to-plan-legacy-system-migration
- https://scalesmiths.co.uk/insights/infrastructure
- https://scalesmiths.co.uk/insights/local-seo-nottingham-businesses-guide
- https://scalesmiths.co.uk/insights/nextjs-vs-wordpress-for-business-websites
- https://scalesmiths.co.uk/insights/offline-first-software-warehouses-field-teams
- https://scalesmiths.co.uk/insights/rbac-vs-abac-permission-models
- https://scalesmiths.co.uk/insights/replace-fragmented-internal-software-without-breaking-operations
- https://scalesmiths.co.uk/insights/security-in-bespoke-software-projects
- https://scalesmiths.co.uk/insights/seo
- https://scalesmiths.co.uk/insights/seo-vs-google-ads
- https://scalesmiths.co.uk/insights/signs-your-business-website-needs-rebuilding
- https://scalesmiths.co.uk/insights/spf-dkim-dmarc-explained
- https://scalesmiths.co.uk/insights/website-hosting-explained
- https://scalesmiths.co.uk/insights/website-redesign-vs-website-refresh
- https://scalesmiths.co.uk/insights/website-seo-checklist-uk-small-businesses
- https://scalesmiths.co.uk/insights/websites
- https://scalesmiths.co.uk/insights/what-are-core-web-vitals
- https://scalesmiths.co.uk/insights/what-does-website-maintenance-include
- https://scalesmiths.co.uk/insights/what-enterprise-software-discovery-should-produce
- https://scalesmiths.co.uk/insights/what-happens-when-your-website-goes-down
- https://scalesmiths.co.uk/insights/what-is-a-web-application
- https://scalesmiths.co.uk/insights/what-is-local-seo-and-do-you-need-it
- https://scalesmiths.co.uk/insights/what-should-a-professional-business-website-include
- https://scalesmiths.co.uk/insights/when-custom-software-costs-less-than-saas-sprawl
- https://scalesmiths.co.uk/insights/when-does-a-business-need-custom-software
- https://scalesmiths.co.uk/insights/when-two-saas-platforms-should-become-one-bespoke-system
- https://scalesmiths.co.uk/insights/why-business-emails-go-to-spam
- https://scalesmiths.co.uk/insights/why-cheap-websites-often-become-expensive
- https://scalesmiths.co.uk/insights/why-scalesmiths-builds-custom-websites
- https://scalesmiths.co.uk/insights/why-use-your-own-email-domain
- https://scalesmiths.co.uk/insights/why-your-website-isnt-showing-on-google
- https://scalesmiths.co.uk/interactive
- https://scalesmiths.co.uk/legal
- https://scalesmiths.co.uk/legal/acceptable-use
- https://scalesmiths.co.uk/legal/accessibility
- https://scalesmiths.co.uk/legal/cancellations
- https://scalesmiths.co.uk/legal/complaints
- https://scalesmiths.co.uk/legal/cookies
- https://scalesmiths.co.uk/legal/data-processing
- https://scalesmiths.co.uk/legal/domain-dns-terms
- https://scalesmiths.co.uk/legal/email-terms
- https://scalesmiths.co.uk/legal/fair-use
- https://scalesmiths.co.uk/legal/hosting-terms
- https://scalesmiths.co.uk/legal/privacy
- https://scalesmiths.co.uk/legal/security
- https://scalesmiths.co.uk/legal/service-terms
- https://scalesmiths.co.uk/legal/subprocessors
- https://scalesmiths.co.uk/legal/website-terms
- https://scalesmiths.co.uk/local-growth
- https://scalesmiths.co.uk/local-growth-check
- https://scalesmiths.co.uk/local-seo-nottingham
- https://scalesmiths.co.uk/locations
- https://scalesmiths.co.uk/locations/hucknall
- https://scalesmiths.co.uk/locations/nottingham
- https://scalesmiths.co.uk/managed-website-hosting
- https://scalesmiths.co.uk/next-js-agency-uk
- https://scalesmiths.co.uk/pricing
- https://scalesmiths.co.uk/quote
- https://scalesmiths.co.uk/security
- https://scalesmiths.co.uk/seo-website-audit
- https://scalesmiths.co.uk/services
- https://scalesmiths.co.uk/services/business-growth-audit
- https://scalesmiths.co.uk/services/managed-business-email
- https://scalesmiths.co.uk/web-design-hucknall
- https://scalesmiths.co.uk/web-design-nottingham
- https://scalesmiths.co.uk/web-development-nottingham
- https://scalesmiths.co.uk/website-maintenance-nottingham
- https://scalesmiths.co.uk/website-redesign-nottingham
- https://scalesmiths.co.uk/work
- https://scalesmiths.co.uk/work/admin-dashboard-foundation
- https://scalesmiths.co.uk/work/confirm-a-kill
- https://scalesmiths.co.uk/work/csds
- https://scalesmiths.co.uk/work/foot-works-podiatry
- https://scalesmiths.co.uk/work/glow-tanning
- https://scalesmiths.co.uk/work/pinkys-prints
- https://scalesmiths.co.uk/work/portal-foundation
- https://scalesmiths.co.uk/work/precision-finish-plastering-rendering
- https://scalesmiths.co.uk/work/prymal
- https://scalesmiths.co.uk/work/quote-system-hardening
- https://scalesmiths.co.uk/work/scalesmiths-platform-build
- https://scalesmiths.co.uk/work/security-hardening-pass
- https://scalesmiths.co.uk/work/seo-aeo-page-architecture
- https://scalesmiths.co.uk/work/the-business-circle
- https://scalesmiths.co.uk/work/veteranfinder
