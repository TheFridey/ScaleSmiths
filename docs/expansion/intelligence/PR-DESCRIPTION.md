# Draft PR: feat(expansion): complete the B0 partner programme foundation

**Status: DRAFT, prepared only. Not opened, not merged, not deployed.** Base: `master` at `4c399b8` (no drift since development began). Branch: `claude/modest-newton-jo2d95`. The text below is the pull-request body, in the repository template's headings so `check:pr-metadata` accepts it (verified locally with a synthetic event; see B0-RELEASE-VERIFICATION.md).

---

## Summary

Completes the B0 "Scale Your Future" partner-programme foundation on top of the Expansion hardening: public programme pages, commercial plans and withdrawals (disabled by default), conditional achievements and referrals (never payable), toolkit and meeting tracking, researched prospect allocation, fail-closed market and exclusivity enforcement, founder-controlled Founding Partner recognition, and consent-bound personal partner webpages behind a restricted public projection (publication off by default). Intake, activation, rewards, withdrawals and public profiles all stay closed until separate founder, legal, accounting and privacy approvals.

## Type

- [x] `feat`
- [x] `test`
- [x] `docs`
- [x] `security`

## Scope

- [x] Public web
- [x] Admin
- [x] Database/migrations
- [x] CI/tooling

## Validation

Commands run, with results:

```text
admin: tsc, eslint . (0 warnings), vitest 1182 passed / 1 failed locally (IPv6 loopback, passes on GitHub runner)
web: tsc, eslint . (0 warnings), vitest 468 passed
integration (9 files): 176 passed, 0 skipped, concurrency suite as restricted scalesmiths_admin and scalesmiths_web
canonical privilege harness: passed incl. injected-drift repair
upgrade from 25a96e6 to head (migrations 0083-0087) on a seeded database: passed
repository gates: 14/15 local (pr-metadata needs a PR); GitHub CI run 44617306801 (workflow_dispatch) see B0-RELEASE-VERIFICATION.md
browser: original expansion journey (exact GBP 705), programme and B0 journeys twice on production builds with restricted roles
```

Commands not run, and why:

```text
check:pr-metadata in CI: needs a real pull request (validated locally with a synthetic event)
Expansion concurrency suite in CI: the workflow does not set EXPANSION_TEST_DATABASE_URL, so it only runs locally
four web visual-baseline tests: baseline machine fonts differ from this container; see B0-RELEASE-VERIFICATION.md
```

## Migrations

- [x] Migration included and documented below.

0073 to 0087, forward-only, none rewritten, registered in the journal, checksums and shared plan. 0084 research allocation, 0085 market enforcement, 0086 recognition, 0087 partner profiles and one security-barrier view. Additive: older code does not reference the new tables; rollback is by restoring the pre-migration backup.

## Environment

- [x] Environment variables added to `.env.example` and documented below.

New switches, all off by default: `PARTNER_PROFILE_PUBLICATION_ENABLED` (admin) and `PUBLIC_PARTNER_PROFILES_ENABLED` (web). Existing `PARTNER_ACTIVATION_ENABLED` and `PARTNER_APPLICATIONS_ENABLED` are unchanged and remain closed.

## Security and Privacy

- [x] No secrets, provider credentials, real `.env` files, database dumps, or
      client-private exports are included.
- [x] Admin/Forge access control and generated-workspace isolation are preserved.
- [x] Public analytics remains minimised and consent-aware.

The public web role may SELECT one security-barrier view only. Partner requests are never evaluated against exclusivity (an independent review found a probing oracle and it was removed). Synthetic data only. Two independent model reviews are not a human audit.

## Evidence

GitHub Actions run 44617306801 (CI), 44617312102 (Security), 44617316618 (CodeQL), all `workflow_dispatch` on this branch; screenshots in `docs/expansion/intelligence/evidence/b0/` and `evidence/programme/`.

## Residual Risk and Follow-up

All commercial, legal, accounting and privacy approvals are outstanding (FOUNDER-DECISIONS.md). Documented low-severity limits remain (B0-FINALISATION-REPORT.md). Partner photographs are not built. B1 to B6 are not started. Remote CI does not run the Expansion concurrency suite.

## Rollback

Restore the pre-migration backup; the new tables are unreferenced by earlier code. Keep both profile switches unset to leave public pages disabled.
