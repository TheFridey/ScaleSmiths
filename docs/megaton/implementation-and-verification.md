# Megaton Phase 1 implementation and verification

13 October 2026. Local working-tree changes on `feat/megaton-mailcow`; not pushed, deployed or declared operational. Mailcow credentials are intentionally left for the owner to wire. The root `.env` is gitignored and contains the prepared placeholders; `.env.example` supplies the portable defaults.

## Implemented

- Private Megaton navigation and responsive Prospects, Discovery, Inbox/Approvals and Operations views. Mobile shows all four view choices without a horizontally hidden tab. Search and pagination reuse existing prospects.
- UK campaign records, reviewed licensed-source imports, duplicate/branch checks and optional Companies House town/SIC discovery. Registry matches explicitly describe registered offices and require trading-location review.
- Source-linked observations, bounded SSRF-safe homepage research, provisional weighted fit scoring with unknown-data handling, 90-day freshness and immutable score snapshots. The model uses the strongest confidence-weighted observation per category; it is not a validated closing probability.
- Exact offer catalog and editable drafts; Growth Partnership includes the audit. Optional bounded AI proposals have dedicated keys, atomic reservations, daily/monthly caps, stale-output rejection and uncertain-cost reconciliation. No model gets unrestricted tools or send authority.
- One explicitly activated company Mailcow connection using verified TLS, bounded IMAP Inbox/Sent cursors, message deduplication, human review and opt-out suppression. Personal mailbox connections remain unsupported.
- Content/account/thread-bound approvals, persisted approver/session checks, suppression and legal-eligibility checks, recent-sync requirement, daily send reservations and an outbox distinguishing SMTP acceptance from uncertain outcomes. No blind retry after an ambiguous send.
- Human claim/handback/close, quotation/meeting review states, cancellation of queued approvals and strict exclusion of automated sends from human-owned conversations. In-app review counts and periodic refresh; no claim of OS push delivery.
- Durable bounded jobs, worker identity revocation, retries/dead letters, manual retry/cancel, optional retention and readable operations/audit records. Existing contract-backed revenue and cash records remain in Command Centre.
- New admin-owned forward migration `0066_megaton_foundation`, journal/checksum registration, RLS isolation, Drizzle declarations and explicit CODEOWNERS coverage. Historical migrations, Forge controls and Nova capital authority were preserved.

## Verification results

| Check | Result and boundary |
|---|---|
| Admin unit suite | 145 files passed; 999 tests passed, 4 existing network-interface-dependent cases skipped |
| Public web unit suite | 71 files passed; 370 tests passed |
| Admin and web lint | Passed |
| Admin and web `tsc --noEmit` | Passed |
| Admin and web production builds | Passed with fresh isolated app installs, without copying the real root `.env` |
| Megaton browser fixture | Passed desktop/mobile using the actual component and production services against embedded PostgreSQL: shared records, draft/eligibility/approval, disabled send and second-founder takeover; no horizontal page overflow or page errors |
| Production dependency audit | Admin `npm audit --omit=dev`: zero reported vulnerabilities; this does not certify development dependencies or container images |
| Root migration history/consistency and tests | Passed; committed history preserved and new checksum registered using canonical line endings |
| Root environment/documentation/architecture gates | Passed |
| Dependency governance and tests | Passed; governed Next/React/Auth versions unchanged |
| GitHub Actions and branch-protection policy/tests | Passed locally; no GitHub run claimed for this unpublished working tree |
| Production-topology checks/tests, release simulation, backup-migration safety | Passed pure tests; these are not a live deployment or backup restore |
| Diff whitespace check | Passed |

Production-service tests exercise PostgreSQL DDL, RLS denial, two founder roles, exact revisions, suppression, revoked identities, approval consumption, takeover, stale mailbox state, duplicate ingestion, AI reservations/uncertain billing, historical scores and repeated import. Network drivers/model responses are controlled fixtures. The browser fixture also substitutes interactive identity/router plumbing; it is not evidence of real founder login or live provider access.

## Limitations and repairs found during checks

The existing checkout's installed dependencies had missing TypeScript/PG files. Verification used clean independent admin/web `npm ci` installations in an isolated tree. The existing outbound DNS-rebinding tests assumed immediate refusal; Windows can safely time out instead. Only their network-error assertion was made portable: protected-decoy hit counts and DNS checks remain enforced, and the production outbound implementation was unchanged. PostgreSQL WASM fixture startup has an explicit bounded timeout for concurrent CI/build load.

Docker Desktop was unavailable, so the full shared-migration/Compose integration, Nginx/container and live recovery gates were not run. An optional standalone Next server probe was rejected by the execution tool with the stated reason “blocked by policy”; no authentication configuration or live system was changed to work around it. Build, service/database and isolated browser evidence are reported separately above.

The mailbox view groups messages by counterparty. Attachments, HTML-only bodies, oversized messages and complex multi-recipient threading require Mailcow review. Discovery coverage for sole traders, broader licensed directories, social connectors, push notifications and the future Nova Core interface remain subsequent work. Retention must be explicitly configured to the company policy. Token-derived usage costs are conservative budget estimates, not provider invoices.

## Before live operation

Follow [Mailcow setup](mailcow-setup.md). Apply the shared migration plan only in an approved environment, complete real founder/PWA and authorised Mailcow send/receipt/reply tests, verify backup/restore and rollback, then release according to the existing protected deployment workflow. No live account, provider call, outbound communication, paid service, production migration or deployment was activated during this implementation.
