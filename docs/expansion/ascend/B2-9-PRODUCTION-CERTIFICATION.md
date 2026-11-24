# Operation ASCEND B2.9: production acceptance, security hardening and operational certification

**Date:** 24 November 2026. **Branch:** `feature/operation-ascend-b2-9` from master `f55a6bc`. **Verdict: NOT CERTIFIED**
for supervised production operation today; see section 9 for the exact conditions that make it *Certified with
restrictions*. A green CI run alone does not change this verdict.

Classification used throughout: **VERIFIED** (observed with evidence), **IMPLEMENTED** (new code, tested off production),
**REMEDIATED** (defect fixed with a regression test), **PARTIAL**, **BLOCKED_EXTERNAL** (needs a founder, production
change approval or access this session did not have), **NOT_TESTED**. Synthetic evidence is always labelled synthetic.

## 1. Executive summary

- The live production baseline matches the mandate (release `f55a6bc`, engine on under a global stop, all five automations
  disabled, nothing executed, recruitment live). **VERIFIED (production, read-only)**.
- The security review found **11 confirmed defects** in the B2.8 engine and Megaton preflight; all are fixed with
  regression tests on real PostgreSQL or unit tests. The most significant: worker identities ignored their action
  assignment (D1), idempotency ignored market scope (D4), the cooldown could be bypassed concurrently (D6), handlers
  ignored market scope (D7), "read-only" was not enforced (D8), and the Megaton preflight could fail open (D10).
  **REMEDIATED**, not yet deployed.
- Operational risks found in production: configuration drift that would switch recruitment off on the next release
  built from the canonical `.env`; public reachability of machine routes; stale canaries on pre-0104 code; a Megaton
  worker with 2.9 million recorded restarts and `autorestart=true`. Detection is **IMPLEMENTED**; remediation is
  **BLOCKED_EXTERNAL** (founder-approved production changes, exact steps in the runbook).
- Backups are intact (**VERIFIED**), a synthetic restore rehearsal passed (**VERIFIED, synthetic**), and a production
  restore drill is **BLOCKED_EXTERNAL** with an executable procedure.
- The supervised first execution was rehearsed end to end on disposable PostgreSQL; in production it is
  **BLOCKED_EXTERNAL**: it needs an interactive founder session with MFA, and it should follow the B2.9 deploy.

## 2. Baseline reconciliation

[Production reconciliation evidence](evidence/b2-9/production-reconciliation.md). Discrepancies against the mandate:

| Mandate statement | Observed | Disposition |
|---|---|---|
| PRs #174 and #177 superseded, to be closed after checking | Both already **merged** (11:31Z); their head commits are ancestors of master | Nothing to close; no duplicate merge |
| Canonical checkout at the live release | On `chore/ascend-worker-preflight-20261123` @ `2460de1`, behind master; its extra lines are older versions of code master superseded | Runbook 5.4 |
| Configuration consistent | 8 governed switches present only in the release `.env` | Drift check added; runbook 5.1 |
| Live processes b257 | Also two stale canaries online (`e48967b`, :3200/:3201) | Runbook 5.3 |
| Partner login HTTP 200 | `/partner/login` is a 307 to `/login` | Consistent; recorded precisely |

## 3. Workstreams

| # | Workstream | Status | Notes and evidence |
|---|---|---|---|
| 3 | Repository and production reconciliation | **VERIFIED** | Section 2 |
| 3 | Deployments preserve recruitment configuration | **IMPLEMENTED** detection; remediation **BLOCKED_EXTERNAL** | `scripts/check-release-env-drift.mjs` (+4 tests, wired into `test:ascend-ops`), run on production: 8 drifts |
| 4 | Backup checksum and archive validation | **VERIFIED (production)** | Both pre-B2.9 dumps |
| 4 | Restore of the production backup into isolated PG14 | **BLOCKED_EXTERNAL** | Procedure: [ASCEND-DISASTER-RECOVERY.md §3](ASCEND-DISASTER-RECOVERY.md#3-production-restore-procedure-operator-needs-founder-approval) |
| 4 | Synthetic restore rehearsal | **VERIFIED (synthetic, PG16)** | 193 tables identical, fingerprints identical, grants re-verified; [output](evidence/b2-9/synthetic-restore-rehearsal.txt) |
| 5 | Machine-route security audit | **REMEDIATED** (D1–D11) | [ASCEND-SECURITY-MODEL.md](ASCEND-SECURITY-MODEL.md) |
| 6 | Command centre functional acceptance | **PARTIAL** | Worker identity creation now assigns actions (UI change + browser spec updated). Existing Playwright journey covers founder auth, approval, worker run, timeline, stop and revocation; it runs in CI. Responsive sweep at 320–1920 px, keyboard and reduced-motion review **NOT_TESTED** this session |
| 7 | Supervised first execution | **IMPLEMENTED** (procedure) / **VERIFIED (synthetic)** / production **BLOCKED_EXTERNAL** | [Runbook §3](ASCEND-OPERATOR-RUNBOOK.md#3-supervised-first-execution-opsqueue_health) |
| 8 | Failure and recovery testing | **VERIFIED (synthetic)** | Integration scenarios: worker death (B), DB connection kill (B2), revoked approver / changed policy / expired approval (C), concurrency (D), emergency stop mid-run (E), transient → dead letter → manual retry (F), ambiguous reconciliation (F2), unauthorised identity (G, I, K, L), prohibited actions (J), duplicate and concurrent submissions (M, N), read-only enforcement (O). Interrupted deployment and application rollback **NOT_TESTED** |
| 9 | Dependency advisories | **REMEDIATED** (production `next`, `nodemailer` alias; dev `js-yaml`) / **PARTIAL** | [Disposition](evidence/b2-9/dependency-advisories.md) |
| 9 | Infrastructure (privileges, env perms, exposure, limits) | **VERIFIED** findings; fixes **BLOCKED_EXTERNAL** | Env files `600 root`; processes run as root without memory caps; public machine routes; runbook §5 |
| 10 | Recruitment and partner journey | **PARTIAL** | Production probes (redirect, login, health) **VERIFIED**; full journey relies on the existing CI Playwright and integration suites; not re-run end to end this session |
| 11 | Megaton containment | **VERIFIED** | Preflight run on production **blocks** (wrong port, unauthorised review notifications); worker not started; [plan](ASCEND-OPERATOR-RUNBOOK.md#4-megaton-containment-do-not-start) |
| 12 | TITAN OS / Jarvis contract | **IMPLEMENTED** (package) | [TITAN-INTEGRATION-CONTRACT.md](TITAN-INTEGRATION-CONTRACT.md); agent API stays off |
| 13 | Observability | **PARTIAL** | The command centre already reports heartbeat, queue depth, approval backlog, dead letters, throughput, retries, p50/p95 start latency, leases and stop state. Oldest-pending age, concurrency utilisation and per-identity activity are not shown; history retention proposed in [DR §5](ASCEND-DISASTER-RECOVERY.md#5-execution-history-growth-and-retention) |
| 14 | Performance and scale | see section 6 | Synthetic only |
| 15 | Release gates | see section 7 | |

## 4. Recruitment and partner journey: exists, enabled, approved

| Capability | Exists | Enabled in production | Commercially approved |
|---|---|---|---|
| Public recruitment page and application form with privacy acknowledgement (`applicant-2026-11-24-v1`) | yes | yes (`PARTNER_APPLICATIONS_ENABLED=true`) | yes (founder-enabled 24 Nov) |
| Founder application review, acceptance and rejection | yes | yes (founder workspace) | yes |
| Market eligibility (GB only candidate market) | yes | yes, fails closed for other markets | GB only |
| Agreement presentation and acceptance | yes | depends on a founder-published agreement version | **not established here**: 0 agreement acceptances in production; no published version was verified |
| Partner activation, login, Academy, resources, knowledge base, objections, pipeline, performance, delivery handoff | yes | login live; Empower content enabled | activation depends on the agreement decision |
| Applicant retention deletion | yes | **off** (`PARTNER_RETENTION_EXECUTION_ENABLED=false`) | not approved |

Remaining blocker for an accepted applicant to become an operational partner: a founder-approved, published partner
agreement (and its acceptance flow) must be confirmed in production. Nothing in B2.9 changes agreements or activation.

## 5. Current switch state (production, unchanged by B2.9)

Engine **on**, scheduler **off**, agent API **off**, global stop **engaged**, all automations **disabled**, no service
identities, Megaton worker **stopped**, retention execution **off**, recruitment **on**.

## 6. Performance (synthetic)

[benchmark-b2-9-synthetic.json](evidence/b2-9/benchmark-b2-9-synthetic.json): the B2.8 harness
(`npm run bench:ascend`) against the B2.9 code. Host: disposable PostgreSQL 16.14 in WSL2 on an ARM laptop. **Synthetic.**

| Partners | Executions stored | Throughput /s (B2.8) | Claim p50 ms (B2.8) | Tick p50 ms (B2.8) | Overview p50 ms (B2.8) | Explorer p50 ms (B2.8) | Duplicate completions |
|---|---|---|---|---|---|---|---|
| 10 | 90 | 2.8 (89.7) | 58.4 (9.7) | 2,101 (72.7) | 2.7 (2.6) | 2.1 (1.2) | 0 |
| 100 | 640 | 3.6 (146.5) | 90.9 (5.4) | 2,023 (52.7) | 2.5 (3.3) | 1.2 (0.8) | 0 |
| 1,000 | 5,540 | 2.5 (173.6) | 109.7 (5.1) | 3,071 (44.7) | 19.7 (13.4) | 1.6 (0.9) | 0 |
| 10,000 | 50,940 | 3.1 (120.0) | 74.6 (5.2) | 2,180 (65.1) | 105.6 (110.2) | 1.7 (1.4) | 0 |

**Interpretation.** Read paths (overview, explorer) match B2.8 at every scale, and claim latency stays flat as history
grows 500-fold, so indexes behave as before. Write-path numbers are 30–60× worse because this host's durable commit is
slow: measured on the same cluster, `select 1` round trip 0.5 ms, a read-only transaction 2.9 ms, **a durable single-row
commit 880 ms p50 / 6.8 s p95** (WSL virtual-disk fsync; the restore rehearsal showed the same `WALSync` waits). A tick
performs about four durable commits. B2.9's only per-run addition is one read-only transaction (≈3 ms, no WAL flush), one
indexed identity read per claim and an exclusive definition lock per submission, so **no regression is attributable to
B2.9, but an equal-host A/B against B2.8 was NOT_TESTED**. Correctness held at every scale (zero duplicate completions).
Re-run on the CI container or the VPS for numbers comparable with [b2-8-benchmark.json](evidence/b2-8-benchmark.json).
50,000-partner scale, CPU/memory profiling and recovery under load: **NOT_TESTED**.

## 7. Release gates run in this session

| Gate | Result |
|---|---|
| Admin TypeScript (`tsc --noEmit`) | pass |
| ESLint on every changed admin file | pass |
| Admin production build (`next build`, next 15.5.29) | pass |
| Admin unit suite (`vitest run`) | 1,410 passed, 19 skipped; 4 PGlite database files timed out under full parallel load on this ARM laptop and pass when run on their own (4 files, 15 tests) |
| New action-handler unit tests | 12 / 12 |
| ASCEND engine integration suite, real PostgreSQL 16 | 18 / 18 (13 existing + 5 new B2.9 scenarios) |
| Shared migrations on a fresh database + role provisioning + privilege verification | pass (web 25/25, admin 105/105) |
| `npm run test:ascend-ops` (worker, preflight, drift) | 15 / 15 |
| Web app typecheck, lint, tests, build | **NOT_TESTED locally** (dependencies not installed); CI |
| Playwright, visual, accessibility, CodeQL, secret scanning, nginx topology, PG14 rehearsal | **CI only** (Docker unavailable locally) |

## 8. Remaining founder decisions

1. Approve the B2.9 release deployment (no migration) and the production hardening in runbook §5 (drift fix, nginx
   machine-route block, retire canaries, delete the Megaton PM2 entry, move the canonical checkout to master).
2. Approve and attend the production restore drill (DR §3).
3. Run the supervised first execution (runbook §3) after the B2.9 deploy.
4. Confirm the published partner agreement and activation decision.
5. Approve an execution-history retention policy (DR §5).
6. Megaton: decide each effect before any restart.

## 9. Certification verdict

**NOT CERTIFIED** for supervised production operation as of 24 November 2026, because (a) the live release `f55a6bc`
contains defects D1–D9, notably that a worker identity would execute automations it was not assigned; (b) no supervised
execution or restore drill has run in production; (c) the configuration drift would disable recruitment on the next
canonical-built release.

It becomes **CERTIFIED WITH RESTRICTIONS** (supervised, single automation, approval required, scheduler and agent API
off, Megaton stopped) when: the B2.9 release is deployed and its CI is green; runbook §5.1 (drift) and §5.2 (nginx) are
done; the production restore drill passes; and the supervised `ops.queue_health` execution completes with a complete
audit trail and unchanged business-table counts.

## 10. Proposed B3 (not adopted)

An earlier roadmap label already uses "B3" for *Sales Studio* (`docs/expansion/intelligence/IMPLEMENTATION-PLAN.md`,
"Not started"), so the mandate's B3.1–B3.8 must be reconciled before adoption. Mapping onto the actual architecture:

| Proposed | Builds on | First increment |
|---|---|---|
| B3.1 Partner intelligence and opportunity discovery | B2.1–B2.3 pipeline and research allocation | Read-only opportunity signals as new `writes: "none"` ASCEND actions |
| B3.2 AI-assisted prospect research and qualification | B2.2 deterministic qualification; overlaps "Sales Studio" | Founder-reviewed research drafts; no outbound contact |
| B3.3 Partner coaching and performance intelligence | B2.5 performance workspace, Empower Academy | Coaching prompts in the founder review inbox |
| B3.4 Commercial forecasting | B2.4 revenue intelligence (authoritative vs hypothetical) | Forecast calibration against recorded outcomes |
| B3.5 International expansion and jurisdiction intelligence | Market gates (0076, 0085) | Jurisdiction checklist per candidate market; nothing activates a market |
| B3.6 Delivery capacity orchestration | B2.6 handoffs, delivery capacity tables | Capacity-aware handoff readiness |
| B3.7 TITAN OS / Jarvis integration | `ascend.operations/v1` | One agent identity, one read-only action, approval required |
| B3.8 Enterprise scaling and resilience | This certification | Scheduled backups, retention policy, unprivileged service user |

**Recommended starting point:** finish B2.9 certification first (section 9), then B3.7 with a single read-only action,
because it exercises the contract and the security model without new business data.
