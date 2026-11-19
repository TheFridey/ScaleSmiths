# Phase A.1 hardening report

19 November 2026. The engineering work is on `feature/operation-expansion-hardening`, based on the verified local and remote `f18b1f9` foundation. GitHub's default branch was `master` at `3db74a0`. The authenticated account had administrator access and no open pull request was returned for the foundation branch. Implementation is committed at `328b2a4` and the retention/financial history test follow-up is `9120d02`. Existing edits to `.entire/agent-guide.md`, `AGENTS.md` and `CLAUDE.md` stay outside those commits.

**Recommendation: CONDITIONAL RELEASE CANDIDATE.** The hardening code passed local application, financial, grant, migration and restore checks. Protected-area approval, green GitHub CI, production restore and monitoring verification, and founder legal/accounting decisions are required before integration or real partner activation.

## What changed

The independent reviews identified gaps in refund entitlement, payout allocation, invoice selection, private resource disclosure, activation, applicant database grants and retention. The [audit](INDEPENDENT-AUDIT.md) preserves the findings and the [remediation register](REMEDIATION-REGISTER.md) ties each change to its verification gate.

- Verified collections require an approved invoice, contract and milestone allocation. Standard and bespoke prices remain distinct from commission terms. Exact replay remains available for historical payments.
- Partial refunds append signed canonical events and independently limit refunded net and VAT. Paid recovery is deliberately manual. New unpaid adjustments require the matching immutable accepted clause. Pending review prevents preparing or approving another batch.
- Prepared payout cancellation records immutable evidence and releases a separate exclusive claim. Approval, invoice amount validation and settlement reference uniqueness prevent changes to the batch or duplicate consumption. The recorded settlement status remains an operator record.
- Partner responses omit client-only resources and private founder review notes. Issuance and invitation consumption require an explicit activation flag, and web database grants permit insertion only into public intake fields.
- Applicant retention previews terminal records and protects holds and linked identities. Execution requires explicit configuration and confirmation of the still-current batch. No destructive schedule was enabled.
- Admin migrations 0071 and 0072 are forward-only and shared through the existing 97-migration plan. The completed synthetic restore confirmed existing £705 earned/paid totals and three backfilled claims. Reprovisioning passes after the serial sequence ownership ordering correction.

## Evidence and open gates

The detailed local verification results are recorded below. Earlier attempts encountered Windows worker-start timeouts and a host filesystem timeout on the original Forge policy run. Those attempts are distinct from successful invocations. This report does not represent independent production or GitHub approval.

| Verification | Command and result |
|---|---|
| Web unit regression | `npm test -- --maxWorkers=1` in web. 84 files and 458 tests passed. |
| Initial full Linux admin run | `npm test -- --maxWorkers=1` inside the Linux builder filesystem. 155 files and 1079 tests passed, four skipped and one retention assertion failed. The unchanged Forge architecture policy passed all three tests. |
| Retention retry | `node node_modules/vitest/vitest.mjs run src/lib/server/expansion-retention.test.ts --maxWorkers=1` in that Linux container. Both tests passed after using the exact enforced foreign key as the assertion. |
| Linux admin full follow-up | 154 files passed. 1078 tests passed, four skipped and two unchanged Forge filesystem scans timed out at their original 5- and 15-second limits. Both had passed in the earlier full run, and the 81-test Forge route suite passed again alone. |
| Final Linux admin full run | `npm test -- --maxWorkers=1` in the Linux builder filesystem after the builds finished. 156 files passed, 1080 tests passed, four skipped and zero failed. Both original Forge scans passed with unchanged time limits. |
| Security focused checks | Admin activation endpoint, partner security and middleware suites passed 23 tests using one Vitest thread worker. |
| Real PostgreSQL races | `node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts test/integration/expansion-concurrency.integration.test.ts --pool=threads --maxWorkers=1` against a dedicated loopback PostgreSQL 18.3 database. Ten passed. Distinct backend identifiers confirmed real contention. The follow-up also verified canonical cancellation, released claims and retained settlement history. |
| Migrations and ownership | Canonical migrator reached 24/24 web and 73/73 admin on fresh targets and on a populated baseline restore. The native restore retained 70500 pence earned and paid, three payments and three claims. |
| Runtime grants | `npm run test:postgres-privileges` with disposable tmpfs passed across six principals and eight injected drift cases. Reprovisioned and verified six principals again on the independent populated native restore after fixing sequence ownership ordering. |
| Candidate archive | Dumped and restored new synthetic PostgreSQL race history and exactly matched 17 payment events, four refunds, 354000 pence earned, two cancellations, eight claims and 60000 pence recorded paid. See [backup and restore evidence](BACKUP-RESTORE-EVIDENCE.md). |
| Repository policy | All 13 executed environment, architecture, release, dependency, topology, migration, Actions, domain and branch-protection checks passed. Documentation links also passed. |
| Public image | Rebuilt the unchanged public sources from the verified Docker build cache. The browser cluster uses the matching public runtime with local synthetic intake settings. |
| Admin image and typecheck | The Docker build passed compile, lint, type validation and static page generation for all 24 pages. The image manifest digest begins `34d33e0e36a5`. A separate `node node_modules/typescript/bin/tsc --noEmit` on the working admin source also exited zero. All 12 changed non-test admin source files matched the local build context. Runtime test and build artefacts are ignored. |
| Browser acceptance | `node --no-warnings node_modules/@playwright/test/cli.js test --config playwright.expansion.config.ts` with explicit loopback origins. One test passed in 47.5 seconds. The test covers the foundation journey and adds founder form submissions for capacity, scope approval, accepted contract, collection, prepare/cancel/reprepare/approve/settle, partial refund review and default-disabled retention deletion. Partner B was denied a financial write and then revoked. |
| Browser database reconciliation | Direct read of synthetic authoritative records returned 70500 pence earned, 70500 pence recorded paid, one cancellation and one refund awaiting entitlement review. The £200 refund calculated a £60 potential adjustment and did not change the recorded paid entitlement. |

The evidence is retained in ignored local `.tmp/hardening-*.log` and `.tmp/expansion-hardening-restore/` paths. Test totals from overlapping runs are reported separately.

Browser screenshots and statement are in `.tmp/expansion-hardening-evidence/`. Desktop, laptop, tablet and mobile checks verified document fit. Desktop and mobile commission screens were visually inspected. The mobile navigation is a horizontally scrolling strip. The browser still uses authenticated endpoints for invoice issue, allocation approval and some collection steps. The full proposed extended checklist was not exercised as a single browser run. Unpaid VAT partial refunds, conflicting/excessive refunds, authorised adjustment, distinct PostgreSQL races and a populated restore were tested separately. The subsequent retainer uses the existing canonical payment flow outside the Expansion qualifying milestones.

| Area | Readiness |
|---|---|
| Public informational page | READY WITH APPROVAL for publication subject to brand review |
| Applicant submission and privacy | READY WITH APPROVAL, with default-closed configuration and approved notice version required |
| Retention, founder recruitment and onboarding | READY WITH APPROVAL after reviewed retention, operating ownership and activation terms |
| Partner authentication and isolation | READY WITH APPROVAL after independent protected-area and deployed origin review |
| Registration, lead protection and suppression | PARTIAL pending approved lead protection, screening and objection-handling process |
| Discovery, scope and assessed delivery capacity | READY WITH APPROVAL after initial capacity and operating process agreement |
| Contract acceptance and payment verification | READY WITH APPROVAL after signed terms and evidence process review |
| Commission, partial/full refunds, unpaid adjustments and payout cancellation | READY WITH APPROVAL only after final application verification and reviewed accounting terms |
| Payout settlement and reconciliation | PARTIAL, manual recorded settlement and invoice comparison available, independent bank verification and dispute resolution require an approved procedure |
| Partner commission centre and text resource library | READY WITH APPROVAL after authorised content publication. Arbitrary file handling is DEFERRED |
| Production migration and runtime privileges | NOT VERIFIED on production. Synthetic fresh migration, upgrade and reprovisioning were exercised |
| Backup and restore | PARTIAL. Synthetic populated recovery and grants verified. Production archive and candidate startup after restore remain separate |
| Production monitoring | NOT VERIFIED |
| Legal agreement, accounting and deployment | BLOCKED pending respective approvals |
| GitHub CI | NOT VERIFIED for Phase A.1 |

The [founder decision register](COMMERCIAL-ACTIVATION-GATES.md), [operator checklist](OPERATIONAL-CHECKLIST.md) and [release runbook](RELEASE-RUNBOOK.md) cover the decisions, execution and rollback. All supplier, applicant, partner and settlement evidence used for testing was synthetic. The hardening branch was prepared locally. Intake and real activation remain closed in production and this operation performed no production deployment or transfer.

Operation Intelligence should follow financial and security acceptance, protected-area review and an approved commercial pilot. Start with approved resource and knowledge workflows, then separately review external website analysis and the existing provider, budget and sandbox controls before connecting paid services.
