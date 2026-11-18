# Operation Expansion repository audit

Audit started 17 November 2026; verification continued 18 November 2026.

## Baseline and scope

- Starting branch/commit: `master`, `3db74a091d481e03e5fed9ea7a6837624e317a41`.
- Dedicated branch: `feature/operation-expansion`.
- Existing local modifications: `.entire/agent-guide.md`, `AGENTS.md`, `CLAUDE.md`. Preserved and excluded from implementation commits.
- Node 22.19.0, npm 10.9.3; app Next.js pin 15.5.28. No dependency versions or lockfiles changed.
- Baseline web unit suite: 82 files / 436 tests passed. Initial admin test, lint, TypeScript and build invocations failed because installed dependency files were absent. Lockfile-preserving `npm ci --ignore-scripts --no-audit --no-fund` restored 655 admin packages; the dependency repair was environmental, not an application change.
- Baseline migration history check passed; history tests 4/4 and consistency tests 2/2 passed before schema changes.

## Sources inspected

Root/app package scripts, protected-area policy, current architecture and RBAC documents, Auth.js configuration/provider, middleware, persistent identity and MFA services, schemas and journals, shared migration planner/checksums, canonical prospects/conversion, clients, commercial contracts/payments/audit, immutable invoice services, capacity forecast, privilege provisioner/verifier, public portal authentication, quote/rate-limit safety, existing UI/site chrome/brand assets, Compose/Nginx topology and Vitest/Playwright configuration.

Brain reported no semantic code index. Graph eventually returned cached code relationships, with degraded SQL parsing; relevant SQL and current source were inspected directly. A later working-tree Graph query hit a pre-existing reparse path under an unrelated worktree; it was not repaired or traversed as part of this operation.

## Findings and resulting integration

| Finding | Decision/change |
| --- | --- |
| Two separately installed Next.js applications share one PostgreSQL database. | Keep two apps and shared authoritative storage. No third deployment/auth stack. |
| Docker Compose and host Nginx, not assumed PM2/SMTP2GO, define production. | Preserve existing topology; use `/partner` on the admin origin and `/partners` on web. |
| Auth.js already supports persistent credentials, durable login throttling, MFA and session revocation. | Extend that identity system; no independent partner password/session implementation. |
| Every existing internal role exposes some global operational data. | Add a narrowly scoped external role and explicit rejection of unrelated/unknown pages and APIs. |
| Generic identity management could bypass external onboarding after adding a role. | Reject generic partner creation/promotion/activation; exclude external identities from internal user lists; enforce founder control and token revocation. |
| Canonical CRM and client conversion already exist. | Partner metadata references canonical prospects; accepted contracts record a canonical existing-client link and frozen conversion metadata, rejecting conflicting mappings. |
| Command Centre already owns append-only collected-revenue and commercial-contract records. | Commission events allocate canonical payments instead of creating a disconnected cash ledger. |
| Invoice `paid` status cannot represent partial collection entitlement. | Verify qualifying collections against issued invoices with evidence and a unique reference; never earn from pipeline/invoice status alone. |
| Existing reversal history permits one reversal per original payment. | Preserve that boundary; full verified collection reversals supported. Partial-refund accounting remains explicitly incomplete. |
| Delivery forecast is useful but not a concurrency-safe reservation system. | Founder assesses remaining partner allocation after existing commitments; transactional reservations prevent overselling that allocation. |
| Public web runtime must not enumerate applicants or access partner finances. | INSERT-only applicant grants and sequence usage; founder read/review/purge remains admin-side. |
| No reviewed partner agreement/privacy/lead-protection terms were supplied. | Close public intake by default, require explicit notice/retention settings, record founder prerequisites, and preserve release gates. No automatic legal determination. |
| Private documents, generated sites and provider spend are sensitive existing boundaries. | Text-only approved resources; no arbitrary document/file access, public previews, crawling or paid AI. |

## Evidence boundaries

Tests use labelled disposable fixtures. PGlite service tests execute production SQL and PostgreSQL semantics, but do not by themselves prove separate-connection contention or runtime grants. Additional real PostgreSQL concurrency and privilege suites were therefore executed. Tmpfs databases establish functional/authorization evidence, not crash durability, production backup/restore or deployed-origin readiness.

Root policy scripts are executable authority. `check:pr-metadata` needs a real GitHub event payload; no PR, push or merge is authorised. Its local context failure must not be represented as a product regression or a successful real-PR validation.
