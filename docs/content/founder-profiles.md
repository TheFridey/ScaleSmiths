# Founder profiles, trust content and imagery

This document records the provenance of founder copy on the public site and the assets
still outstanding. Code that publishes founder statements cites this file as evidence
(`web/src/lib/founders.ts`), so keep it accurate.

## Owner-supplied role brief — 15 September 2026

Supplied by the ScaleSmiths owner as the basis for founder profiles.

**Rhys** — Co-founder. Technical leadership, strategy, software engineering, web systems,
architecture, SEO/technical implementation, delivery.

**Trevor Newton-Bradley** — Co-founder. Commercial growth, client relationships, sales,
business development, account relationships.

Positioning: clients work directly with the people responsible for strategy, commercial
direction and implementation, rather than being passed from salesperson to account manager
to outsourced developer.

No employment history, qualifications, certifications, awards, founding date, client counts
or revenue figures were supplied, and none are published.

## Outstanding facts (intentionally unpublished)

| Item | Where it would be used | Status |
| --- | --- | --- |
| Rhys's surname (if it should be public) | Person schema, profile page | TODO — owner |
| First-person founder biographies | `/about/rhys`, `/about/trevor-newton-bradley` | TODO — founders |
| Authored articles/insights | `Founder.insights` | None published yet |
| Founder LinkedIn/GitHub URLs | `NEXT_PUBLIC_FOUNDER_*` | Unset |
| Business LinkedIn / Google Business Profile / socials | `NEXT_PUBLIC_SCALESMITHS_*` | Unset |
| Legal name, company number, registered office, VAT | `web/src/lib/legal.ts` | TODO — see `LEGAL_DECISIONS_REQUIRED` |
| Telephone number | Organization schema, footer | Not published |
| Founding date | Organization schema | Not published |
| Confirm-A-Kill case study | `web/src/lib/data.ts` | Not published — no case study or assets in repo |
| Client testimonials | `public_claims` (verified claim records) | None verified |
| Client logo permissions | `web/src/lib/client-proof.ts` | None approved |

## Image assets required

All imagery must be real. No stock, AI-generated or mocked photography or screenshots.

### Founder photography — `web/public/images/team/`

| File | Content | Size |
| --- | --- | --- |
| `rhys.webp` | Natural portrait of Rhys | ~1200×1500 (4:5), < 250KB |
| `trevor.webp` | Natural portrait of Trevor Newton-Bradley | ~1200×1500 (4:5), < 250KB |
| `rhys-trevor.webp` | Both founders together | ~1600×1067 (3:2), < 300KB |

After adding a file, set `available: true` in `web/src/lib/team-images.ts` and describe the
actual photo in its `alt`. `team-images.test.ts` fails if the flag and the file disagree.

### Case study screenshots and client logos

See [case-study-media.md](case-study-media.md) for the naming convention, capture sizes and the full list.

## Alt text convention

Describe what the image shows and whose work it is, in plain language:

- Good: "Confirm-A-Kill pest control website designed and developed by ScaleSmiths"
- Bad: "SEO web design Nottingham website design agency best Nottingham web designer"
