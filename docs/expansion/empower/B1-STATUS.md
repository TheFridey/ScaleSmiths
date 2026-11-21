# Operation Empower: B1 status

Recorded 2026-11-20 by an agent. Model review is not human approval and is not presented as one.

## Summary

| Workstream | Status |
|---|---|
| B0 merge (PR #155) | COMPLETE: merged 2026-11-20 as `ad5a9e5` under an owner solo-maintainer decision (see "B0 merge record") |
| B1 planning package factual audit | COMPLETE (agent read-back; see [CONTENT-REVIEW-REGISTER.md](CONTENT-REVIEW-REGISTER.md)) |
| Editorial, commercial and technical corrections | COMPLETE for confirmed defects; remaining items need founder, legal, accounting or privacy decisions |
| Founder approval register | PARTIAL: consolidated and extended; **no decision is recorded** |
| Accessibility review | PARTIAL: token-level review complete; no rendered screens exist to test |
| Knowledge-check questions | NOT STARTED (written per lesson after approval; finding F14) |
| PR #156 (planning) | COMPLETE: merged into `master` as `8950011` (owner instruction), CI, Security and CodeQL green |
| B1 implementation (`feature/operation-empower`) | B1.1 content governance, B1.2 Partner Academy, B1.3 Resource Centre and B1.4 Knowledge Base COMPLETE on the branch, tested, not approved or enabled (reports: [B1.2](B1-2-ACADEMY-REPORT.md), [B1.3](B1-3-RESOURCE-CENTRE-REPORT.md), [B1.4](B1-4-KNOWLEDGE-BASE-REPORT.md)); B1.5 onwards NOT STARTED |
| B1 deployment, publication, partner activation | NOT STARTED; not authorised |

## B0 merge record (2026-11-20)

The repository owner (`TheFridey`), who is also the sole code owner and the PR author, reviewed PR #155 personally and instructed the merge without a second reviewer. GitHub cannot record an author's approval, so **the PR has no recorded review**. This is an owner solo-maintainer decision, not an independent review, and no model review is counted as approval. `master` still has no branch protection applied.

| Check | Observed |
|---|---|
| Head merged | `4e713e5847156968826d1b6c64b45371b1d36847`, pinned with `--match-head-commit` |
| Checks on that head | 21 of 21 passing |
| Strategy | Merge commit (repository convention) |
| Merge commit | `ad5a9e51553e30e59b3603e19c94777abe0f41e2`, parents `4c399b8` (previous `master`) and `4e713e5` |
| Tree | Identical to the reviewed head's tree |
| Post-merge workflows on `ad5a9e5` | CI (run 44749811513) success, Security success, CodeQL success; PR Metadata skipped (push event) |
| Protected flags (`.env.example`) | `PARTNER_APPLICATIONS_ENABLED`, `PARTNER_ACTIVATION_ENABLED`, `PARTNER_PROFILE_PUBLICATION_ENABLED`, `PUBLIC_PARTNER_PROFILES_ENABLED`, `PARTNER_RETENTION_EXECUTION_ENABLED` all `false` |
| Deployment | No GitHub workflow deploys. Production deployment remains a manual release-manager step and did not happen. Host-side automation on the VPS not verified |
| Branch | `claude/modest-newton-jo2d95` kept, not deleted |

Recommended follow-up: record this exception in `docs/operations/protected-areas-and-branch-protection.md`, and either apply `scripts/branch-protection-policy.json` or document why it is not applied.

## B0 merge blocker (as recorded before the merge)

| Check | Observed |
|---|---|
| `master` | `4c399b87e833b12d15791f6b5f8b08ab35871667` |
| PR #155 | Open, **draft**, head `4e713e5`, base `master`, `MERGEABLE`, merge state `CLEAN` |
| Merge base | Equals `master` (branch is up to date) |
| CI on `4e713e5` | CI, Security and CodeQL `success`; 21 of 21 check contexts pass |
| Reviews | None. No review requests |
| Branch protection on `master` | `404 Branch not protected`; no rulesets (`rules/branches/master` returns `[]`) |
| CODEOWNERS | Every path owned by `@TheFridey` |
| Collaborators | `TheFridey` (admin) only, who is also the PR author |
| Deployment | No GitHub workflow deploys; merge would run CI, Security and CodeQL on `master` only. Host-side automation not verified |

Why the merge cannot proceed legitimately:

1. The required code-owner approval cannot be given: the only code owner is the PR author, and GitHub does not let an author approve their own pull request.
2. The documented protection (`scripts/branch-protection-policy.json`) is not applied, so GitHub would accept a merge today. That is a reason not to merge, not permission to.
3. The PR is still a draft.

The agent did not approve, dismiss reviews, change settings, edit CODEOWNERS, use administrator override or merge.

**Owner-administered options** (unchanged from [B0-MERGE-READINESS.md](../intelligence/B0-MERGE-READINESS.md)):

1. Add a trusted second person with write access, list them in CODEOWNERS for the protected paths, apply the protection policy, and have them review against the B0 reviewer checklist after the final push; or
2. Record a documented solo-maintainer exception in `docs/operations/protected-areas-and-branch-protection.md`. This is the owner's decision. It does not make a model review count as approval.

The reviewer package for B0 (financial invariants, migrations 0073 to 0090, PostgreSQL privileges, concurrency, exclusivity, allocation, public profile projection, revocation, domain release, CI changes, backup and rollback, deployment triggers) is the checklist in B0-MERGE-READINESS.md, verified against head `4e713e5`. It is not repeated here.

## B1 implementation gate

| Gate condition | Met |
|---|---|
| 1. B0 merged into `master` | Yes, `ad5a9e5`, by owner decision without a recorded review |
| 2. Merge commit verified | Yes |
| 3. `master` CI verified after merge | Yes: CI, Security, CodeQL success |
| 4. No unauthorised production deployment | Yes, as far as GitHub shows; host-side automation not verified |
| 5. PR #156 reconciled with the merged foundation | Yes: merged as `8950011` |
| 6. Approved planning baseline on the implementation branch | Yes for Phase 1: owner accepted `AP-GOV-04`, `AP-GOV-06`, `AP-ENG-01`, `AP-ENG-02` on 2026-11-20. Content items remain unapproved |
| 7. Repository governance satisfied | Owner exception for B0; not yet recorded in the protected-areas document |

`feature/operation-empower` was created from `master` at `8950011`.

## B1.1 content governance (2026-11-20)

| Capability | Status |
|---|---|
| Versioned content items with permanent audience and review cadence | COMPLETE |
| Draft editing, submission, founder decision (approve, request changes, reject) with append-only evidence | COMPLETE |
| Two-founder rule (`AP-GOV-04`) | COMPLETE: refused in the service while more than one founder is active; self-approval needs a recorded reason, enforced in the database |
| Review dates within cadence (`AP-GOV-06`), expired content never served | COMPLETE |
| Publication with supersession, withdrawal with reason | COMPLETE |
| Audience restriction in SQL (`servableContent`) | COMPLETE at service level; no partner route yet |
| Audit history (`expansion_audit`, `empower_*`) | COMPLETE |
| Founder Content studio in `/expansion`, behind `EMPOWER_FOUNDER_CONTENT_ENABLED` (default `false`) | COMPLETE |
| Markdown renderer, content links, diff view, preview as partner, seed script, legacy adapter | DEFERRED to later slices (plain text only today) |

Nothing is published to partners. No content item has been created or approved in any real environment. Evidence: [ACCEPTANCE-CRITERIA.md](ACCEPTANCE-CRITERIA.md), "B1.1 evidence". B1 application code must not be built on the B0 feature branch or a substitute branch.

## PR #156 handling

- Retargeted to `master` after the B0 merge. No rebase was needed: the branch is `master` plus two documentation commits, and the diff is 29 files, all under `docs/expansion/empower/` (27 original documents, this file and the review register).
- `node scripts/check-documentation-links.mjs` passes. Merge only after its own checks and the owner's approval.

## Next decisions for the founders

1. Record the B0 solo-maintainer exception and decide on applying branch protection.
2. Review [CONTENT-REVIEW-REGISTER.md](CONTENT-REVIEW-REGISTER.md) and record the Phase 0 exit decisions in [FOUNDER-APPROVAL-REGISTER.md](FOUNDER-APPROVAL-REGISTER.md): at least `AP-GOV-04`, `AP-GOV-06`, `AP-DES-01`, `AP-ENG-01` to `AP-ENG-04`.
3. Start professional reviews that block the most content: the partner agreement (solicitor), commercial terms (accountant), and the privacy notice and marketing process (privacy adviser).
