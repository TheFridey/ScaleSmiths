# Production feature activation matrix (Operation EMPOWER B2.10)

**Current values** come from committed evidence only: [production-reconciliation.md](../ascend/evidence/b2-9/production-reconciliation.md) (24 November 2026) and [B1-7-PROJECT-AEGIS-FINAL-REPORT.md](B1-7-PROJECT-AEGIS-FINAL-REPORT.md). The VPS was **not** read during B2.10; every "current" value must be re-read on the server before activation (runbook step 2). "Unrecorded" means no committed document states the live value; the code default is off.

All switches are parsed as the exact string `true`. Every rollback is: set the value back, restart the admin container (or web for web switches), re-run the drift check. No switch below deletes data; turning one off hides the surface and keeps every record.

## Recommended for launch (in this order)

| # | Switch | Current | Recommended | Reason | Dependencies | Approval | Verification | Rollback |
|---|---|---|---|---|---|---|---|---|
| 1 | `PARTNER_APPLICATIONS_ENABLED` (+ `PARTNER_APPLICATION_PRIVACY_VERSION=applicant-2026-11-24-v1`, `PARTNER_APPLICATION_RETENTION_DAYS=180`) | true / set / 180 | **unchanged** | Recruitment is live worldwide | privacy notice version | already given | `/partners` shows the form; drift check `identical` | `false` closes the form; stored applications are kept |
| 2 | `PARTNER_EMAIL_ENABLED` | unrecorded | **true** | Application confirmation, invitation and activation emails | `RESEND_API_KEY`, `RESEND_FROM` (sending domain verified in Resend) | founders: confirm sender | Controlled test application to a founder-owned address; `partner_notifications` row `sent` | `false`; founders share invitation links by hand (the founder UI already reports `disabled`) |
| 3 | `PARTNER_ACTIVATION_ENABLED` | unrecorded (off at B1.7) | **true, only after an agreement is published** | Invitations and account creation | a published, current agreement version; `GB` market approved | **yes** (Founder checklist item 1) | Issue an invitation to a synthetic applicant; activation page loads with `preview` | `false` stops new invitations; existing partners keep access |
| 4 | `PARTNER_PIPELINE_ENABLED` | unrecorded (off) | **true** | Pipeline board, interactions, follow-ups | none | no | `/partner/pipeline` loads for a partner, 404 for none | `false` |
| 5 | `PARTNER_QUALIFICATION_ENABLED` | unrecorded (off) | **true** | Opportunity qualification | pipeline | no | qualification panel on an opportunity | `false` |
| 6 | `PARTNER_PERFORMANCE_ENABLED` | unrecorded (off) | **true** | Partner's own performance view | none | no | `/partner/performance` | `false` |
| 7 | `DELIVERY_HANDOFF_ENABLED` | unrecorded (off) | **true** | Partners see accepted projects handed to delivery | contract acceptance flow | no | `/partner/handoffs` | `false` |
| 8 | `PARTNER_ACADEMY_ENABLED` | unrecorded (off at B1.7) | **true once at least one course is published** | Optional learning | published courses (journey shows "Awaiting setup" until then) | content approval | `/partner/academy` lists published courses | `false` |
| 9 | `PARTNER_RESOURCE_CENTRE_ENABLED` | unrecorded (off) | **true once R01, R07 and R09 are published** | Sales material | published resources | content approval | `/partner/resources` search and download | `false` |
| 10 | `PARTNER_KNOWLEDGE_BASE_ENABLED` | unrecorded (off) | **true once entries are published** | Approved answers | published entries | content approval | `/partner/knowledge` search | `false` |
| 11 | `PARTNER_OBJECTION_HANDLING_ENABLED` | unrecorded (off) | **true once responses are published** | Objection responses | published responses | content approval | `/partner/objections` | `false` |
| 12 | `PARTNER_UNIFIED_WORKSPACE_ENABLED` | unrecorded (off) | **true after 8–11** | Search across all guidance, Today panel | 8–11 | no | `/partner/guidance` | `false` |

## Keep as they are

| Switch | Current | Recommended | Reason |
|---|---|---|---|
| `EMPOWER_FOUNDER_CONTENT_ENABLED` | true | true | Founders need the Content Studio to publish |
| `PARTNER_RETENTION_EXECUTION_ENABLED` | false | **false** | No automatic destructive retention |
| `PARTNER_PROFILE_PUBLICATION_ENABLED`, `PUBLIC_PARTNER_PROFILES_ENABLED` | off | **off** | No partner is eligible yet (five qualifying clients); public pages need consent and approval |
| `ASCEND_ENGINE_ENABLED` | true | true | B2.9 certified state |
| `ASCEND_SCHEDULER_ENABLED`, `ASCEND_AGENT_API_ENABLED`, `ASCEND_AUTOMATION_ENABLED` | false / false / unset | **unchanged** | No unattended scheduling or machine execution; B2.9 certification governs these |
| `MEGATON_*` | per B2.9 | unchanged | Megaton containment |

## Recovery and withdrawal (no new switch)

Password recovery and applicant withdrawal add no switch. Their pages and endpoints are always present after deployment and always answer with the same generic message. They deliver a link only when row 2 is on (`PARTNER_EMAIL_ENABLED` with Resend). Until then, founders reset passwords and record withdrawals as they do today.

## Drift protection

B2.10 adds the 13 partner switches (activation, email, Academy, resources, knowledge, objections, unified workspace, pipeline, qualification, performance, delivery handoff, profile publication ×2) to `GOVERNED_SWITCHES` in `scripts/check-release-env-drift.mjs`. A release environment that lacks or differs from the canonical file on any of them now blocks the release. A test (`scripts/check-release-env-drift.test.mjs`) also proves that each of the 13 is fail-closed: it is read in code only as an exact `"true"` comparison, and documented `false` in `.env.example`. **Before the first B2.10 release, copy the approved values into the canonical `.env` on the VPS**, otherwise the check will (correctly) report drift.
