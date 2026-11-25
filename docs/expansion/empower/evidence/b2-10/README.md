# B2.10 evidence

## Visual evidence (component renders)

`journey-<width>.png`, `journey-complete-<width>.png` and `overview-new-partner-<width>.png` at 320, 390, 768, 1024, 1440 and 1920 px.

**How they were produced.** The real `JourneyView` and `JourneySummary` components and the real `expansion.css` and `journey.css` were rendered to static HTML with representative journey data (a temporary harness, since removed). The pages were then captured in Chrome via Playwright. At every width the capture script checked for horizontal overflow and for controls under 40 px tall; it found **none**.

**What they are not (component renders only).** These earlier renders are not screenshots of a running server; the full-stack browser evidence is in `browser/` (below). When they were taken, no database-backed run was available (Docker was not running and `.env` was not read). The sidebar in the renders is static markup that mirrors the new navigation.

Captured defects that were fixed before these renders:
- Primary journey actions rendered as links had gold-on-gold text: `.expansion a` overrode `.ex-button`. Fixed in `journey.css`.
- An email toolkit request read "Requested: Requested by the partner…". Fixed in `partner-journey.ts`.

## Full-stack verification (B2.10 continuation)

The database and browser runs used disposable PostgreSQL containers only: loopback, `tmpfs`, and the repository's committed CI test credentials.
- No `.env` file was read.
- Nothing touched production or any existing local database.
- The two suites whose safety guards accept only `127.0.0.1:55440` (Expansion concurrency and ASCEND engine) ran inside a Linux container that shares the test database's network namespace, because an unrelated local service holds that port on the host. No guard was relaxed.

| Evidence | What it shows |
|---|---|
| `ci-local/SUMMARY.txt` steps 1-6 | Local mirror of CI's Database and Migrations job: PostgreSQL 14 rehearsal (including 0105/0106 least-privilege checks), main integration, Empower and onboarding, concurrency and ASCEND engine, sole founder, golden path, least-privilege roles |
| `ci-local/SUMMARY.txt` steps 7-10 | Production build, typecheck, lint, full unit suite (raw logs kept locally; `*.log` is ignored by the repository) |
| `ci-local/SUMMARY.txt` step 11, `browser/` | Playwright Empower suites against the production build, including `b2-10-partner-launch.spec.ts`: an authenticated partner journey, recovery, withdrawal, the review queue and the founder command centre. Screenshots at 320 to 1920 px |

## Production probes (read-only, 24 November 2026)

| Request | Result |
|---|---|
| `GET https://partners.scalesmiths.co.uk/partner` | 307 → `/login` (portal live, authentication enforced) |
| `GET https://partners.scalesmiths.co.uk/login` | 200 |
| `GET https://partners.scalesmiths.co.uk/api/health` | 401 `{"status":"unavailable"}` (normal when unauthenticated) |
| `GET https://scalesmiths.co.uk/partners` | 200; retention notice present |
| `GET https://scalesmiths.co.uk/api/partner-applications` | 405 (POST-only endpoint present) |

The deployed commit was **not** verified (no VPS access in this session).
