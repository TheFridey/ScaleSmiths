# Public claims evidence register — initial repository audit

Date: 2026-07-18  
Status: current implementation backlog  
Scope: public numerical, revenue, retention, project-count, customer-result, testimonial/attributed quote, paid-for-itself, timeline, performance, and published pricing statements found in the repository.

All entries below are seeded as `draft`, with `client_approval_status = pending`. They do not render publicly until an authorised reviewer records evidence, permission where required, a future review date, and a verified decision in admin. No source listed below is itself proof; it identifies where the assertion previously appeared or the records an operator must locate.

## Agency-wide and delivery claims

| Stable ID | Proposed wording summary | Evidence / permission required |
| --- | --- | --- |
| `hero.projects-delivered` | 12+ projects delivered | Dated project ledger defining what counts as delivered. |
| `hero.revenue-generated` | GBP 300k+ revenue generated | Client-scoped revenue evidence, attribution method, period, and written publication permission. |
| `hero.retainer-retention-rate` | 100% retainer retention | Client/retainer cohort, period, calculation method, and current review. |
| `service.projects-across-uk` | Projects delivered across UK sectors | Portfolio/client records and permission for any non-public client relationship used. |
| `service.most-clients-retain-30-days` | Most clients retain within 30 days | Cohort definition, launch dates, retainer dates, and calculation. |
| `process.built-on-time` | Delivered on time | Agreed baseline dates, accepted scope changes, completed-project sample, and calculation. |
| `process.most-clients-retain` | Most clients convert to a retainer | Defined cohort and signed retainer records. |
| `portal.every-active-client` | Every active client receives a portal from day one | Current client/portal mapping and definition of active/day one. |
| `delivery.weekly-portal-updates` | Weekly portal updates | Delivery policy plus project records showing the cadence is consistently met. |
| `delivery.enquiry-response-one-working-day` | Enquiry response within one working day | Enquiry timestamps, working-hours definition, exclusions, and a reviewed compliance period. |
| `portal.support-response-one-working-day` | Support response within one working day | Support-agreement scope, request/response timestamps, priority exclusions, and a reviewed compliance period. |
| `timeline.foundation` | Foundation typically 4–6 weeks | Completed-project distribution and documented exclusions. |
| `timeline.growth` | Growth typically 8–12 weeks | Completed-project distribution and documented exclusions. |
| `timeline.forge` | Forge typically 12–24 weeks | Completed-project distribution and documented exclusions. |

## Testimonials and attributed quotes

The repository contained only one wording/name combination for each quote. That does not prove authorship or client approval. No alternative name or wording has been guessed; all three remain uncertain and unverified.

| Stable ID | Recorded attribution | Evidence / permission required |
| --- | --- | --- |
| `testimonial.glow-tanning.tom` | Tom M., Glow Tanning; includes “paid for itself twice over” | Original message/source, identity confirmation, revenue/cost basis for the paid-for-itself statement, exact-wording approval, and publication permission. |
| `testimonial.pinkys-prints.beth` | Beth C., Pinkys Prints | Original message/source, identity confirmation, exact-wording approval, and publication permission. |
| `testimonial.csds.chris` | Chris S., CSDS | Original message/source, identity confirmation, exact-wording approval, and publication permission. |

## Client/project claims

| Stable ID | Proposed wording summary | Evidence / permission required |
| --- | --- | --- |
| `project.glow-tanning.outcome.bookings-first-week` | Bookings in first launch week | Booking records, launch date, attribution caveat, and client permission. |
| `project.glow-tanning.outcome.review-display` | Google/Facebook reviews combined | Deployed implementation evidence and permission to name integrations. |
| `project.glow-tanning.outcome.self-managed` | Routine changes without developer help | Client confirmation and definition of routine changes. |
| `project.pinkys-prints.catalogue-size` | More than 120 products | Dated catalogue export and permission. |
| `project.pinkys-prints.outcome.zero-downtime` | No customer-visible migration downtime | Monitoring/deployment logs, incident window, and client confirmation. |
| `project.pinkys-prints.outcome.monthly-saving` | Significant monthly saving | Before/after invoices, calculation, period, and client permission. |
| `project.csds.outcome.distinctive` | Distinctive market presence | Approved qualitative client statement; avoid presenting internal opinion as measured outcome. |
| `project.csds.outcome.less-friction` | Reduced phone/email friction | Before/after workflow evidence or explicit qualified client statement. |
| `project.csds.outcome.self-managed` | Owner manages enquiries in one interface | Deployed acceptance evidence and client confirmation. |
| `project.business-circle.outcome.billing-day-one` | Live billing from launch | Launch/release and Stripe evidence with sensitive data excluded, plus permission. |
| `project.business-circle.outcome.native-video` | In-platform video rooms | Deployed acceptance evidence and permission. |
| `project.business-circle.outcome.roles` | Granular multi-tier access | Role-policy/acceptance evidence and permission. |
| `project.prymal.agent-count` | 14 specialist agents | Versioned product inventory proving the count for the reviewed release. |
| `project.prymal.outcome.integrated-platform` | Listed capabilities integrated | Release/acceptance evidence for every named capability. |
| `project.prymal.outcome.production-model` | Docker/Nginx/logging/monitoring/API docs | Release evidence for every named production surface. |
| `project.veteranfinder.outcome.monorepo` | Web/admin/API in one maintained repository | Repository/release evidence and project-owner permission. |
| `project.veteranfinder.outcome.auth` | Member/admin session coverage | Test/release evidence and security-reviewed wording. |
| `project.veteranfinder.outcome.deployment` | Single-server and container runbooks | Current runbook evidence and project-owner permission. |

## Published price claims

Each price needs an approved current rate card, owner approval, included/excluded scope, VAT wording where applicable, and a review date. These are publication claims; the budget bands in enquiry forms are separately retained as user-selectable qualification inputs and are not displayed as promises.

- `price.one-page`
- `price.foundation`
- `price.growth`
- `price.forge`
- `price.care-plan`
- `price.maintenance-retainer`
- `price.growth-retainer`
- `price.ecosystem-retainer`

## Build-log performance statements

These statements require release-specific CI/test evidence matching the exact wording. A current successful build alone must not be represented as historical proof for a different release.

- `build-log.scalesmiths-platform-build.business-value`
- `build-log.quote-system-hardening.business-value`
- `build-log.portal-foundation.business-value`
- `build-log.seo-aeo-page-architecture.business-value`
- `build-log.admin-dashboard-foundation.business-value`
- `build-log.security-hardening-pass.business-value`
- `build-log.scalesmiths-platform-build.outcome`
- `build-log.quote-system-hardening.outcome`
- `build-log.portal-foundation.outcome`
- `build-log.seo-aeo-page-architecture.outcome`
- `build-log.admin-dashboard-foundation.outcome`
- `build-log.security-hardening-pass.outcome`

## Reconciliation notes and exclusions

- Hardcoded project outcomes and testimonials were removed from public static data. Neutral capability lists remain as fallbacks because they describe implemented scope rather than measured client results.
- Project/client names, locations, technology labels, repository links, and authorship credits were not promoted to verified commercial outcomes by this change. They should receive a separate portfolio-rights review if publication authority is uncertain.
- Enquiry budget/timeframe option values are inputs supplied by the visitor, not published ScaleSmiths prices or delivery guarantees. They remain in the quote and interactive forms.
- CSS percentages, image dimensions, schema/software versions, dates used for legal-document versions, and private admin financial data are outside this claims audit.
- Operational availability text must still be maintained accurately; it is not evidence for a client result.

Human action remains required for every row. The migration intentionally invents no evidence, permission, verifier, or verification date.
