# Operation EMPOWER B2.11 (Project Launchpad): progress report

Status as of 25 November 2026. This is an **interim** report. It records the first tranche of B2.11:
- the production engineering repairs (workstream A);
- the verified production baseline.

It does not certify the full partner lifecycle. The remaining workstreams are listed honestly in section 6.

## 1. Executive verdict

**NOT READY** for real partner onboarding yet. Evidence:
- **No approved market.** `expansion_markets` has 0 rows. A database constraint makes approval require four reviews, an approval reference and a founder `approved_by`, so activation cannot be enabled. See [FOUNDER-ACTION-REGISTER.md](FOUNDER-ACTION-REGISTER.md) item 1.
- **No withdrawal policy.** `expansion_withdrawal_policies` has 0 rows, and it also needs a founder approval.
- **No partner content.** The Content Studio holds only the published agreement; the curriculum has not been imported.
- **Not deployed.** This branch is not yet deployed, so the permanent scrolling fix is not live. Production still runs the B2.10 build: release 3f2d649, with the scroll fix applied as a hand-edited compiled stylesheet.

Once items 1–4 of the founder register are done and this release is deployed, the expected verdict is **READY WITH SPECIFIC RESTRICTIONS**:
- UK only;
- withdrawals by founder review;
- toolkit items fulfilled manually.

## 2. Work completed

| Area | Change | Evidence |
|---|---|---|
| A2 scrolling (root cause) | `admin/src/app/globals.css` set `body { overflow: hidden }` on every route. Only the founder `.admin-shell` provides its own scroll region (`.admin-main`). Partner pages outside that shell could not be scrolled: Academy frame, agreement, resources, knowledge, objections, guidance, pipeline, performance, handoffs, activation, reset and withdrawal. The lock is now scoped to `html:has(.admin-shell)`, and the document scrolls everywhere else. | `admin/src/app/globals-scroll.test.ts`: passes with the fix, fails (2 of 3) on the old CSS |
| A2 agreement | `.ac-document` no longer uses a nested 60vh scroll box. The agreement reads in the page flow. This carries the production hotfix's intent into source. | same tests; browser spec below |
| A2 / E11 delivery handoffs | The page moved from an inline-styled bare `<main>` into the shared partner frame (`AcademyShell`): skip link, partner navigation and a "Delivery" nav item. Confidentiality wording and data are unchanged. | typecheck, lint |
| J browser proof | New `admin/test/e2e/b2-11-partner-scroll.spec.ts`, run in CI "Empower Browser Acceptance" against a production build. It signs in as the seeded synthetic partner. At 1440×900, 1024×768, 390×844 and 360×800 it checks every partner page for:<ul><li>an unlocked document;</li><li>no horizontal overflow;</li><li>last content reachable after scrolling.</li></ul>It also checks the signed-out reset, withdrawal and activation pages, and confirms the founder shell still locks the document and scrolls inside `.admin-main`. | CI run on the PR (see section 5) |
| A3 build failure (root cause) | The 25 Nov failure (`Failed to collect page data for /api/ascend/v1/operations/[id]/cancel`, `TypeError … Object.values`) was **not an ASCEND defect**. In the hotfix tree `releases/b210-scroll-hotfix`, `admin/node_modules` was a symlink into the live release, and `admin/.next/cache/webpack` held that release's cache. Webpack resolved through the other tree. The build log shows `Attempted import error: 'CLIENT_REQUEST_STATUSES' is not exported…` for every root `domain/` re-export, before the crash. The source is byte-identical to the live release, apart from `academy.css`. | A clean build from a fresh tree (own `npm ci`, no cache) exits 0. It reports 0 import errors and collects page data for all routes, including the cancel route. |
| A4 deployment reliability | New `scripts/check-release-tree.mjs` (`npm run check:release-tree <dir>`). It refuses to build a release whose `node_modules` is a symlink, or whose webpack cache names another release. Run on the server, it flags `b210-scroll-hotfix` (exit 1) and passes `3f2d649…` (exit 0). Its unit tests run in CI. | `scripts/check-release-tree.test.mjs` 3/3 |

## 3. Verified production baseline (read-only, 25 Nov 2026)

- **Traffic:** nginx routes all three hosts to PM2 pair `scalesmiths-{web,admin}-b210` on ports 3400/3401, release `3f2d6497…` (B2.10, PR #179).
- **Rollback pair:** `scalesmiths-*-b257` (f55a6bc) is still online on ports 3300/3301.
- **Canonical checkout:** `/var/www/scalesmiths/ScaleSmiths` is at **8cf5c71, not 3f2d649**. It has an uncommitted `academy.css` edit (the scroll hotfix) and two empty stray files: `admin/node` and `admin/scalesmiths-admin@0.1.0`, dated 22 Sep.
- **Abandoned tree:** `releases/b210-scroll-hotfix`, 1.1 GB. Not referenced by PM2 or nginx.
- **Capacity:** disk 83% used (26 GB free); memory 8 GB available; no build processes running.
- **Backups (latest):**
  - `scroll-css-20261125T114743Z` (the replaced stylesheet);
  - `pre-agreement-2026-11-25T113250785Z`;
  - two env snapshots.
- **Switches** (canonical `.env` and live release `.env` agree on every governed partner switch):

| State | Switches |
|---|---|
| on | applications, email, founder content |
| off | retention execution, ASCEND scheduler, ASCEND agent API |
| unset (off) | activation, pipeline, qualification, performance, handoffs, Academy, resources, knowledge, objections, unified workspace, both profile switches, ASCEND automation |

- **Resend:** `RESEND_API_KEY` and `RESEND_FROM` are set (values not read).
- **Records:** markets 0, withdrawal policies 0, agreement acceptances 0.
- **Public endpoints:**
  - `admin.scalesmiths.co.uk/login` and `partners.scalesmiths.co.uk/login` return 200;
  - `/partner/agreement` signed out redirects (307) to login;
  - `www.scalesmiths.co.uk/partners` redirects (308) to the apex.

## 4. Deliberately not done in this tranche

- **Production write actions** are in [FOUNDER-ACTION-REGISTER.md](FOUNDER-ACTION-REGISTER.md), because each needs a founder identity, a founder approval or a go-ahead to deploy:
  - deploy;
  - env switch changes;
  - curriculum import;
  - market and withdrawal-policy records;
  - deleting the abandoned tree.
- **No synthetic applications, invitations, emails or financial records** were created in production.

## 5. Technical evidence

| Check | Result |
|---|---|
| `tsc --noEmit` (admin) | pass |
| eslint on changed files | pass |
| Targeted vitest (shell, Academy, handoffs, scroll guard) | 141 passed / 1 timeout under parallel load (`empower-academy-isolation`), which passes when run alone (2/2) |
| Full admin vitest | see PR description |
| `node --test scripts/check-release-tree.test.mjs` | 3 pass |
| `npm run check:github-actions` | pass |
| Clean admin production build (fresh worktree) | exit 0; 0 import errors |
| Browser suite incl. B2.11 spec | runs in CI on the PR |

## 6. Remaining B2.11 workstreams (not yet started or not yet verified)

These remain open and **must not be read as done**:
- **B:** public claims reconciliation;
- **C2–C5:** executed-agreement completeness, the market and activation tests;
- **D:** content import, review queue and the Academy, Resource Centre and Knowledge Base flows;
- **E:** workspace audit;
- **F:** commercial reconciliation against the V4.1 text, and the withdrawal and commission lifecycle;
- **G:** founder sections;
- **H:** toolkit;
- **I:** email deliverability (SPF, DKIM, DMARC);
- **J:** full 7-viewport, all-route visual and accessibility register;
- **K:** security regression;
- **L:** 45-step lifecycle;
- **M:** switch activation;
- **N4:** deploy;
- **O:** remaining evidence documents.

The order is [REMAINING-DEVELOPMENT-BACKLOG.md](REMAINING-DEVELOPMENT-BACKLOG.md).
