# Public service-routing architecture

Last reviewed: 2026-07-19

ScaleSmiths keeps one public brand and separates service discovery into two buying journeys:

- `/local-growth` is the route for trades, clinics, hospitality businesses, and founder-led local companies. Its first-step CTA is `/local-growth-check`, with the shared quote route available as a secondary short enquiry.
- `/custom-systems` is the route for portals, e-commerce, SaaS, AI implementation, automation, integrations, real-time systems, and complex infrastructure. Its CTAs create a project brief or retain `strategy_call` intent in the existing quote workflow.

`/services` remains the indexable service hub. Existing intent-specific SEO routes remain indexable and are linked from the relevant journey:

- Local: `/web-design-hucknall` and `/web-development-nottingham`.
- Systems: `/custom-web-app-development-uk`, `/e-commerce-development-nottingham`, and `/next-js-agency-uk`.

The shared source of truth is `web/src/lib/service-journeys.ts`. It owns audience definitions, route-specific outcomes and process copy, proof mappings, internal links, CTAs, canonical metadata, and JSON-LD inputs. Public proof cards use the existing project records and do not render unverified outcome claims.

The homepage and `/services` reuse `ServiceRouteChooser`. Main and footer navigation link directly to both journeys. Pricing remains governed by the existing verified-claims system and `/pricing`; journey copy states that project and ongoing-support pricing is scoped rather than publishing private or unverified figures.

No legacy service route was consolidated in this change, so no redirect was required.
