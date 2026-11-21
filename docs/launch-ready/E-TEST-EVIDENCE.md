# Operation Launch Ready: test evidence

All runs local on Windows 11, Node 22.19, on 2026-11-21, at the commits listed in the changelog. CI results are recorded on the pull request.

## Commands and results

| Check | Command | Result |
|---|---|---|
| Admin typecheck | `cd admin && npx tsc --noEmit -p .` | pass |
| Admin lint | `npx eslint .` | pass |
| Admin unit (full) | `npx vitest run` | 1288 passed, 4 skipped, 5 failed. The 5 failures are timeouts in Forge and static-policy tests whose files this branch does not touch; the failing set changes between runs, and all 5 files pass when run alone (91/91). Treated as machine-load flakiness; CI is the arbiter |
| New admin unit suites | `partner-lifecycle`, `partner-email`, `partner-notifications.database` (PGlite, real 0096 DDL), `partner-invitations.database` (PGlite, real 0095 DDL; 15 tests, 5 new negative cases), activate route (9), `RecruitmentPanel` link safety | all pass |
| Web typecheck, lint, unit | `cd web && npx tsc --noEmit -p . && npx eslint . && npx vitest run` | pass; 87 files, 470 tests |
| Web production build | `npm run build` | pass |
| Admin production build | `npm run build` | pass |
| Migrations, restricted roles | provision, migrate, provision, verify (`admin/scripts/*`) on PostgreSQL 18, port 55444 | web 25/25, admin 97/97; privilege verification passed |
| Real-PostgreSQL suites (restricted admin role) | `vitest.integration.config.ts`: empower-content, academy, resources, knowledge, **partner-onboarding** | 5 files, 34 tests passed |
| Concurrency suite | `expansion-concurrency.integration.test.ts` on `ss_expansion_hardening_races` | 89 passed (includes the two activation races, now through agreement acceptance) |
| Browser (Playwright, production build, disposable DB) | `npx playwright test -c playwright.empower.config.ts` | 4 passed: 3 B1 journeys and the Launch Ready onboarding journey |
| Repository checks | migration history, shared plan, GitHub Actions, env hygiene, documentation links, local state, dependency governance, domain boundaries | all pass |

## Coverage of the directive's negative cases

| Case | Covered by |
|---|---|
| Unauthorised approvals | viewer refused on founder commands and snapshot (real PostgreSQL); partner refused on founder API (browser) |
| Missing agreements | activation without acceptance refused; free-text and unpublished versions refused at invitation |
| Expired or withdrawn invitations | expiry and withdrawal (PGlite); withdrawn agreement fails closed without consuming the token (both) |
| Duplicate submissions and replay | used link refused (browser); second activation refused; duplicate reissue refused |
| Invalid state transitions | service 409s and direct SQL refusals as the runtime role |
| Cross-tenant access | partner B cannot download or forge partner A's acceptance |
| Direct API bypass | direct `update ... set activated_at` and forged inserts refused by the database |
| Concurrent approval races | two concurrent acceptances record one; concurrent activation consumes once; activation racing market suspension |
| Suspended accounts and revoked permissions | revoked partner refused on the agreement API |
| Stale text or tampering | wrong digest refused ("has changed"); stored digest re-verified on download |

## Browser coverage

Mouse clicks, form filling, select menus, checkboxes, two-step confirmation, scrolling a region to unlock controls, native form validation (an unticked acceptance does not submit), a file download, redirects for anonymous users, console-error capture (only plain-HTTP harness artefacts excluded, with the reason in the spec), axe at WCAG 2.2 AA, and four viewport widths with an overflow check.

## Known limitations

- Session expiry, network failure mid-activation and keyboard-only traversal are not automated.
- No real email was sent: delivery is tested with a stub transport; Resend itself was not exercised.
- The browser spec is not wired into CI. Like the B1 spec, it needs the seeded MFA stack; it runs locally from the committed spec.
- PostgreSQL 18 was used locally; production is 14.24. The SQL uses no features newer than PostgreSQL 11 (`sha256()`), and CI runs PostgreSQL 16.
