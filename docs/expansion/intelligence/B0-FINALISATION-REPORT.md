# B0 finalisation report (checkpoint 5)

Branch `claude/modest-newton-jo2d95`. Starting head `4417203`; this report covers `25a96e6` (checkpoint 4) to the pushed head. **B0 is implemented and verified here. It is not released.** Every commercial, legal, accounting, privacy and production approval is outstanding, and B1 has not been started. Synthetic data only; nothing was deployed, merged, emailed, paid out or published, and no pull request was opened.

## Implementation status
| Item | Status |
|---|---|
| 0083 verified on real PostgreSQL as the restricted admin role; browser database migrated | Done. Found and fixed: trigger helper functions needed an explicit admin EXECUTE grant (PGlite never enforces it) |
| Founder interfaces: review-flag queue, reward withdrawal, meeting correction | Done, browser-verified |
| Researched prospect allocation (0084) | Done: database, service, API, founder and partner screens, 14 real-PostgreSQL scenarios |
| Market enforcement (0085): residence, operating, customer markets | Done across invitation, activation, partner progression, scope approval, allocation, acceptance |
| Exclusivity across the lifecycle | Done where a partner cannot observe it (see review finding 2) |
| Founding Partner recognition (0086) | Done, founder-controlled, no thresholds, badge in the partner portal |
| Personal partner webpages (0087) | Done; **publication switched off by default in both apps**; photographs not built |

## Commits (oldest first)
`4417203` residual findings A–F (start) · `132d4a9` verify 0083 on real PostgreSQL · `143c6ef` flag, withdrawal, correction screens · `2060ed8` allocation (0084) · `661069f` market enforcement (0085) · `84558e4` recognition (0086) · `2078acb` profiles (0087) · `b4d8440` profile screens and public route · `4183b52` browser acceptance and fixes · `e897a7c` lint tidy · `a9fca9b` docs and policy test · review-fix commit (lock order, exclusivity oracle, stale facts, consent coverage) · final report commit.

## Migrations (forward-only, none rewritten)
0084 research allocation · 0085 market enforcement · 0086 recognition · 0087 partner profiles and the public view. The 0083 file was not modified after its commit. Registered in the journal, checksums and shared plan; both migration gates pass.

## Verification (final code)
| Check | Result |
|---|---|
| Admin unit/service tests | 1,182 passed, 4 skipped, **1 failed: `safe-outbound` IPv6 loopback** (this container cannot bind `::1`, `EAFNOSUPPORT`; the test was not weakened and must be run on an IPv6-capable host or GitHub CI) |
| Web unit tests | 468 passed |
| PostgreSQL integration, 9 files | 176 passed, 0 skipped. The concurrency suite (85 tests, checkpoints 3 to 5E) ran as the **restricted `scalesmiths_admin` role**; the public-role test ran as **`scalesmiths_web`**; repeated three times after the review fixes |
| Canonical privilege harness (shimmed to native PostgreSQL 16) | Passed, including injected drift rejection; the policy test now asserts the web role holds exactly one named view, SELECT only |
| Fresh migration | Browser database built from empty through admin 88 of 88 |
| Upgrade from checkpoint 4 (`25a96e6`) | Database built at that head with synthetic rows; 0083 to 0087 applied; rows preserved, new defaults correct, privileges verified, new guards act on old rows as the restricted role |
| Typecheck and `eslint .` (admin, web) | Clean, zero warnings |
| Repository gates | 14 of 15 pass. `check:pr-metadata` needs a pull-request event and runs only in CI; its script tests pass (23) |
| Gate script tests | All pass |
| Production builds (admin, web) | Both succeed |
| Original `expansion.spec.ts` journey (fresh database) | Passed; reconciles exactly **£705**. Only change: GB market approval moved earlier (it is now required before invitation and progression); assertions unchanged |
| Authenticated programme journey | Passed twice, now also driving flag resolution, reward withdrawal and meeting correction in the UI |
| New B0 journey (`b0-finalisation.spec.ts`) | Passed twice |
| Public recruitment tests | 10 of 10 against a default-configuration production server (the intake-closed assertion needs defaults) |
| Full web Playwright chromium project | WEBE2E |

The browser stacks ran production builds with the restricted runtime roles (`scalesmiths_admin`, `scalesmiths_web`). Steps are labelled [UI], [API] or [SQL] in the specs. The B0 journey uses [SQL] only to give two synthetic partners an approved personal-webpage reward (the five-qualifying-client path is proven separately on real PostgreSQL). Evidence: `evidence/b0/` (desktop and 390px mobile) and `evidence/programme/`.

## Defects found by verification (all fixed)
1. Restricted role lacked EXECUTE on two trigger helpers (PGlite hid it).
2. Founder live checks (suppression, existing prospect) evaluated against an unselected domain and always read "none" (found by the browser; allocation itself re-checked from the full row and was never unsafe).
3. A direct database withdrawal bypassed the "new recorded reason" rule.
4. Partner mobile tab strip overlapped labels.
5. Earlier tests ran with 24 skipped because of fixture gaps; fixed.

## Independent review (fresh agent, read-only)
No critical or high findings; no SQL injection, partner IDOR or financial regression. Medium findings **fixed**: (1) lock-order inversion in allocation against classify and exclusivity decisions (deadlock risk, 503 not corruption); (2) a one-bit exclusivity oracle in partner progression, so partners are now gated on markets only and founders enforce exclusivity where it cannot be observed; (3) a revived prospect kept stale facts and (4) a clearance survived an edit, so facts are now fixed once a prospect or clearance exists. Also fixed: consent text now names every public element (v2), a recognition correction cannot set a future date, allocation requires the receiving partner's operating market. **Documented, not changed (low):** a partner-supplied customer country counts for progression before confirmation; acceptance does not re-check the operating market; changing an operating market takes no 7102 lock; excluding a previously released candidate leaves its prospect holding the domain; achievement text is static; founder dashboard evaluates up to 300 candidates in one transaction; recognition approval has no second approver; the reserved-slug list is exact-match.

## Unresolved approvals and genuine blockers
- All approvals in `FOUNDER-DECISIONS.md` (markets, programme version and rewards, screening standard, volume, benefits, consent wording and privacy notice, indexing, enquiry route) are outstanding. Intake and activation stay closed.
- Partner photographs are **not built**: no secure upload, scanning or serving pipeline exists.
- Unverified here: GitHub CI (including `check:pr-metadata`), the IPv6 test, real Docker (native PostgreSQL 16 plus a command shim were used), and crash durability.
- Real partner pages require both switches (`PARTNER_PROFILE_PUBLICATION_ENABLED`, `PUBLIC_PARTNER_PROFILES_ENABLED`) and a separate release decision. Neither is set anywhere except the disposable test stack.
