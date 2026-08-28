# Domain ownership in the ScaleSmiths modular monolith

**Baseline date:** 28 August 2026  
**Status:** Incremental boundary policy

ScaleSmiths remains a modular monolith. A domain boundary is an in-process TypeScript API and an explicit data-ownership rule, not a network service, separate deployment, dependency-injection container, or generic repository framework.

## Ownership map

| Domain | Owns | Current public boundary |
| --- | --- | --- |
| Public acquisition | Quote capture, public funnels and quote notifications | Web quote modules; `server/acquisition-read-service.ts` exposes the admin failure count |
| Identity | Admin users, sessions, MFA, RBAC and security audit | Auth.js configuration, `rbac.ts`, and identity server modules |
| Clients | Internal client identity, contact/service state and the explicit portal-client mapping | `server/client-read-service.ts`; client mutation routes and validation in `clients.ts` |
| Portal | Portal accounts/sessions and the authenticated client boundary | `portal-client-profile.ts` plus ownership-filtered portal APIs; admin consumes shared operational records without taking migration ownership |
| Delivery/projects | Requests, timeline, kanban, project state and delivery capacity | `portal-client-requests.ts`, `server/delivery-read-service.ts`, and existing delivery/request modules |
| Finance | Invoice catalogue/settings, invoice lifecycle, immutable documents, delivery and audit | `portal-invoices.ts`, `server/invoices.ts`, invoice delivery/document modules, `server/finance-read-service.ts` and finance validation |
| Sales | Prospects, outreach, proposal tracking and sales proposals | `server/sales-read-service.ts`, `server/sales-lead-context.ts`, proposal generator and sales validation |
| Reporting | Monthly reports and client analytics | `portal-reports.ts`, `server/reporting-read-service.ts`, report/analytics modules and validation |
| Forge | Forge projects, runs, tasks, jobs, artifacts, memories, AI budgets, workspaces, QA and release evidence | Stable `server/forge-run-orchestrator.ts` facade and focused Forge server modules |

Public boundaries are deliberately small functions. They may return use-case-specific read models rather than leaking Drizzle tables or query builders. Route handlers and Server Component pages are adapters/composition roots: they enforce authentication/authorization, call domain APIs, and shape transport/UI responses.

## Dependency rules

1. React components do not import `db` or `schema`. Data arrives through props or an authenticated route.
2. A route or page that needs several domains composes their public server functions; it does not query all of their tables itself.
3. Domain validation stays with the owning domain. Callers pass inputs through the domain parser instead of duplicating enum, money, lifecycle, or identity rules.
4. Shared infrastructure is limited to database connectivity, monitoring, authentication plumbing, and genuinely shared contracts under `domain/`. A shared folder must not become a home for business logic with unclear ownership.
5. Cross-domain dashboards call one narrow read API per owning domain. Aggregation happens at the page composition root without granting one domain authority over another domain's lifecycle.
6. Finance may snapshot client billing data transactionally because invoice issuance requires an immutable historical record. It must not mutate general client profile state except through protected finance fields and lifecycle operations.
7. Forge may reference a client or consume an explicit sales/delivery input, but it must not update client, portal, sales, finance, or reporting tables as an incidental side effect of generation. Cross-domain writes require an owning-domain command.

## Incremental enforcement

`npm run check:domain-boundaries` prevents database/schema imports from UI components, keeps the dashboard and clients page behind domain read APIs, and verifies those APIs remain server-only. The rule is intentionally narrow: existing route-level storage access remains technical debt and should be migrated domain by domain before broadening the allow/deny surface.

The admin dashboard is a legitimate composition root. Its acquisition, client, sales, delivery, finance, and reporting data now come from separate domain-owned read functions. Report-due matching uses the explicit `portal_client_id`; display-name matching is not an ownership mechanism.

## Known coupling retained

- Web and admin still declare some shared portal tables separately; migration ownership remains web-first and strict.
- Several API routes still query their domain tables directly, especially prospects, reports, client requests and Forge project endpoints.
- Forge economics resolves client names through one batch client-domain query and Forge-attributed proposal value through one sales-owned SQL aggregate; it does not issue per-row lookups.
- Sales proposal generation still reads Forge artifacts directly, while client/prospect proposal context remains a candidate for further separation. Forge proposal generation now consumes prospect/outreach evidence through the sales-owned `sales-lead-context.ts` API.
- Finance reads and updates protected client billing/sequence fields inside invoice transactions. This is an intentional consistency boundary and must remain governed by finance authorization and immutability tests.
