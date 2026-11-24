# B2.10 evidence

## Visual evidence (component renders)

`journey-<width>.png`, `journey-complete-<width>.png` and `overview-new-partner-<width>.png` at 320, 390, 768, 1024, 1440 and 1920 px.

**How they were produced.** The real `JourneyView` and `JourneySummary` components and the real `expansion.css` and `journey.css` were rendered to static HTML with representative journey data (a temporary harness, since removed). The pages were then captured in Chrome via Playwright. At every width the capture script checked for horizontal overflow and for controls under 40 px tall; it found **none**.

**What they are not.** They are not screenshots of a running admin server signed in as a partner. No database-backed browser run was possible in this session: Docker was not running, and the local PostgreSQL needs credentials from `.env`, which were not read. The sidebar in the renders is static markup that mirrors the new navigation. The full-stack browser suites (`playwright.empower.config.ts`, CI job) remain the authority and run in CI.

Captured defects that were fixed before these renders:
- Primary journey actions rendered as links had gold-on-gold text: `.expansion a` overrode `.ex-button`. Fixed in `journey.css`.
- An email toolkit request read "Requested: Requested by the partner…". Fixed in `partner-journey.ts`.

## Production probes (read-only, 24 November 2026)

| Request | Result |
|---|---|
| `GET https://partners.scalesmiths.co.uk/partner` | 307 → `/login` (portal live, authentication enforced) |
| `GET https://partners.scalesmiths.co.uk/login` | 200 |
| `GET https://partners.scalesmiths.co.uk/api/health` | 401 `{"status":"unavailable"}` (normal when unauthenticated) |
| `GET https://scalesmiths.co.uk/partners` | 200; retention notice present |
| `GET https://scalesmiths.co.uk/api/partner-applications` | 405 (POST-only endpoint present) |

The deployed commit was **not** verified (no VPS access in this session).
