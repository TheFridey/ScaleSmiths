# Operation Expansion status

This is the foundation checkpoint. Later Phase A.1 verification and release decisions are recorded in the [hardening report](hardening/FINAL-REPORT.md).

18 November 2026. Critical foundation journey: COMPLETE in isolated local acceptance. Overall programme: PARTIAL. Production activation: BLOCKED by the release decisions below. See FINAL-REPORT.md and CHANGED-FILES.md for the full inventory, evidence and operating instructions.

## Repository checkpoints

Baseline: 3db74a091d481e03e5fed9ea7a6837624e317a41. Branch: feature/operation-expansion. Audit/plan checkpoint: 004d98b. Implementation checkpoint: d44c158 (66 files). Subsequent acceptance-test and report checkpoints follow in local Git history. No dependency versions or lockfiles changed.

Acceptance-test refinement checkpoint: bb4febc. Screenshot follow-up verified twelve loaded founder/partner views, including laptop/tablet/mobile commission screens, with no document overflow and no commercial mutations (final-admin-visual-results.json).

Existing user modifications to .entire/agent-guide.md, AGENTS.md and CLAUDE.md are preserved and excluded from operation commits. No push, merge or deployment occurred.

## Feature inventory

The functioning foundation includes gated recruitment/applications; founder review and retention controls; existing Auth.js external-role isolation; single-use activation, renewal and revocation; partner/founder workspaces; canonical prospect registration, duplicate/suppression checks, discovery and scope review; assessed delivery reservations; immutable versioned accepted terms and canonical client conversion; verified collection allocation; append-only commissions, full collection reversals, cancellation, manually approved/reconciled payouts, CSV statements and published text resources.

The complete requested 30-step journey passed against the finished production Docker images. It used actual application/review/invitation/activation/discovery/scope forms and authenticated founder API commands. Exactly 30000 + 30000 + 10500 = 70500 pence commission was earned. Identical deposit replay added no commission. Partner B could not read or mutate A's records or access founder administration. Payout preparation, manual approval and recorded settlement reconciled displayed balances and CSV client/milestone values. Revoked Partner B was denied while its login screen remained usable. No transfer took place.

Broader resource/document/contact history, advanced dashboards and reminders remain PARTIAL. Partial refunds, prepared-payout cancellation and automatic notifications are NOT STARTED. Website audits, Sales Studio, AI/support and Phases B/C/D automation/scale are DEFERRED. No placeholder counts as completed functionality. Public intake remains disabled by default.

## Executed verification

| Check | Result | Evidence log |
|---|---|---|
| Web baseline | 82 files / 436 passed | web-test.log |
| Web full suite after recruitment | 84 files / 457 passed | web-final-test.log |
| Later public privacy regression check | 2 files / 22 passed; overlaps full suite and includes later regression | web-privacy-focused.log |
| Admin final full suite, Linux | 155 files / 1068 passed / 4 skipped / 0 failed tests | admin-full-linux-tests-final.log |
| Admin Windows full run | 154 passed files / 1 failed; 1067 passed, 1 filesystem scan timeout, 4 skipped tests | admin-final-test-resume.log |
| Unchanged Forge architecture scan, Linux | 3 passed; scan 11.509 seconds under original 15-second limit | Included in final full suite |
| Focused core/finance | 3 files / 23 passed; overlaps full suite | admin-focused-core.log |
| Auth/schema/middleware focused runs | Initial reported runs 196 passed; later 5 files / 55 passed; overlapping counts | Focused logs/full suite |
| Real PostgreSQL separate-connection races | 1 file / 4 passed; distinct backend PID assertions | admin-expansion-concurrency.log |
| Real PostgreSQL privilege harness | PASS; all 95 migrations; six principals and five injected drift cases | postgres-privileges.log |
| Fresh post-restart shared migration/seed | web 24/24 and admin 71/71; guarded demonstration owner/client seeded | shared-test-migrations-acceptance.log and seed-expansion-demo-acceptance.log |
| Final web production build | Compile/lint/types PASS; 162 static pages | web-docker-build-final-typography.log |
| Final admin production build | Compile/lint/types PASS; 24 static pages | admin-docker-build-display-final.log |
| Runtime source/context hashes | 33 changed production source files matched; 0 mismatches | source-context-hashes.json |
| Final repository policies | 13/13 PASS | final-policy-results.json |
| Full 30-step browser/API acceptance | 1 passed / 0 failed; test 37.6 seconds, run 50.8 seconds | expansion-browser-e2e-acceptance.log |
| Public responsive/keyboard checks | Four viewport sizes PASS; no overflow/clipping/runtime errors; final visual rerun 0 submissions | public-visual-results.json |

Logs are under ignored .tmp/expansion-baseline/. Screenshots, visual results and partner-commission-statement.csv are under ignored .tmp/expansion-evidence/. Authenticated screens use clearly identified demonstration records. Screenshot-only reruns do not mutate applications, prospects, collections or payouts.

Earlier Windows worker/startup failures, interrupted duplicate builds, Docker read-only storage/WSL recovery and one unsupported --minWorkers invocation are environment/harness failures, not passing checks. The first browser attempt exposed a real published-resource projection omission, which was fixed and regression-tested. A later attempt needed a less strict dropdown-label test selector. Security controls and test thresholds were retained. The host Forge scan timeout is recorded separately from the successful Linux result. Real PR metadata validation is unavailable without a GitHub event payload; no PR was created.

The final 13 policies covered environment hygiene, enforced architecture/release documentation, dependency governance, production topology, migration history/consistency/order, GitHub Actions, domain/database environment boundaries and branch protection. Earlier metadata, backup migration-safety and release-simulation unit checks passed. Production backup/restore, host Nginx and live provider workflows were not established by these results.

## Demonstration and release boundary

Local public preview: http://localhost:3102/partners. Admin login: http://localhost:3103/login; founder workspace /expansion, partner workspace /partner. The task-owned PostgreSQL container is ss-expansion-ephemeral-20261117, loopback port 55440, database ss_expansion_test. It uses tmpfs and may lose all demonstration state on stop/restart. It proves no crash durability. Docker restart was explicitly authorised because it interrupts other local containers.

No production mutation, external email, paid provider request or live transfer occurred. Do not copy demonstration credentials into a normal environment. Real intake/activation requires reviewed privacy/retention settings, independent-status and accepted agreement records, lead-protection/refund decisions, accounting approval, independent protected-area review, production grants/backup/restore verification and explicit deployment approval. Keep admissions closed until those conditions are met.
