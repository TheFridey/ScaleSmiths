# Operation Launch Ready: implementation changelog

Branch `feature/operation-launch-ready`, from `master` at `a436712`.

## Commits

| Commit | Summary |
|---|---|
| `037cdd9` | feat(db): partner agreements, acceptance evidence and enforced application lifecycle (web 0024, admin 0095) |
| `33aab81` | feat(admin): agreement acceptance at activation, founder recruitment workspace, partner agreement page |
| `b919cdd` | test: agreement integrity, approval gates and onboarding on real PostgreSQL |
| `af92373` | feat: auditable partner lifecycle email, off by default (admin 0096) |
| `726ef93` | fix(email): keep applicant-typed URLs and addresses out of greetings (security review finding) |
| `f0aeb81` | test(e2e): onboarding journey in a real browser, with evidence |
| `5140b2e` | test(e2e): avoid the ES2018 dotAll flag |
| `f887661` | fix(admin): link applicant LinkedIn values only when HTTPS (self-review finding) |

## Migrations (forward-only, additive)

| Migration | Purpose | Data effect |
|---|---|---|
| web `0024_repair_web_vital_event` | Re-asserts the `web_vital` enum label (production drift, defect D1) | none; idempotent |
| admin `0095_partner_agreements` | `agreement` content kind; issued-version and acceptance columns on `expansion_partners`; `partner_agreement_acceptances` (append-only); activation guard; `information_requested` status; transition guard | none: new columns are nullable; production has 0 partners and 0 applications |
| admin `0096_partner_notifications` | email log with recipient hash, idempotency key, forward-only outcomes | new table |

Privilege policy: the admin runtime gains EXECUTE on `partner_agreement_digest`, `partner_agreement_current` and `partner_application_transition_allowed`; the web runtime gains INSERT only on `partner_notifications`.

## Features added

- **Agreements:** a versioned, founder-approved, immutable-once-published agreement document; issued with the invitation; read in full and explicitly accepted at activation; reissue and re-acceptance; downloadable copies with digest verification; founder register.
- **Lifecycle:** an enforced transition map with an "information requested" state and an applicant-visible message kept separate from internal notes.
- **Founder workspace:** a recruitment panel with status chips and counts, search, country and date filters, legal next moves only, confirmations pre-filled (previously they were cleared on every review), a two-step confirmation for consequential actions, the agreement register and the recruitment audit history.
- **Applicant:** a three-step activation page with the full agreement, a scroll-to-end unlock, typed-name acceptance and password confirmation.
- **Partner:** an agreement page with history and downloads, and a first-login "Your next steps" checklist.
- **Email:** six transactional templates and an auditable log, off by default; the founder is told the outcome of each send.

## Defects fixed

- D1: Web Vitals beacons returned 500 (repair migration).
- D3: the agreement was a free-text label ticked by a founder (now a real, partner-accepted, digest-bound record).
- D4: application transitions were unenforced.
- Review confirmations were cleared on every review (now pre-filled).
- Found during this work: applicant-controlled text could steer a public-form email (greeting sanitised), and an applicant-controlled link could carry `javascript:` (HTTPS-only links).

## Files

New: `admin/drizzle/0095_partner_agreements.sql`, `0096_partner_notifications.sql`, `web/drizzle/0024_repair_web_vital_event.sql`, `domain/partner-email.ts`, `admin/src/lib/partner-lifecycle.ts`, `admin/src/lib/partner-agreements.ts`, `admin/src/lib/server/partner-agreements-core.ts`, `partner-agreements.ts`, `partner-notifications.ts`, `admin/src/app/api/partner/agreement/route.ts`, `admin/src/app/api/expansion/agreements/[id]/route.ts`, `admin/src/app/partner/agreement/page.tsx`, `admin/src/app/partner/activate/activate.css`, `admin/src/components/expansion/RecruitmentPanel.tsx`, `PartnerAgreement.tsx`, `PartnerNextSteps.tsx`, `web/src/lib/server/partner-application-email.ts`, plus tests and `docs/launch-ready/`.

Changed: `partner-invitations.ts`, `expansion.ts`, `empower-content.ts` (lib and server), `rbac.ts`, `authorization-policy.ts`, `ExpansionWorkspace.tsx`, `AcademyShell.tsx`, the activation page and route, `web/src/lib/partner-applications.ts`, the web application route, the privilege policy, the migration plan and checksums, CI (new suite in the restricted-role step), `.env.example`.
