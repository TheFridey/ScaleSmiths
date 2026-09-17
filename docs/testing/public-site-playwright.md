# Public Site Playwright Tests

The public ScaleSmiths website has browser coverage under `web/tests/e2e`.

## Run Locally

```bash
cd web
npm run test:e2e:chromium
```

Run the full browser matrix when changing browser-specific behaviour:

```bash
cd web
npm run test:e2e:cross-browser
```

Authenticated client-portal coverage is a focused Chromium project:

```bash
cd web
SCALESMITHS_TEST_ENVIRONMENT=forge-v2-e2e \
WEB_DATABASE_URL=postgresql://scalesmiths_web_test:local_ci_only@127.0.0.1:5432/scalesmiths_web_e2e \
MIGRATION_DATABASE_URL=postgresql://scalesmiths_web_test:local_ci_only@127.0.0.1:5432/scalesmiths_web_e2e \
PORTAL_SECRET=local_ci_only_portal_session_secret_32_chars \
npm run test:e2e:portal
```

The portal project seeds two disposable clients plus an invitation account in the guarded PostgreSQL fixture, then covers login/logout, disabled/reset sessions, requests/replies, reports, invoices/PDF, timeline, milestones, documents, and negative IDOR cases. Prepare the isolated database the same way the Web CI job does (`test:db:prepare`, `db:migrate`, `test:db:seed`, `test:db:assert`) before running it.

`npm run test:e2e` remains available for an intentionally broad local run of every configured project.

The Playwright config starts the web app on `127.0.0.1:3210` by default. Override with:

```bash
PLAYWRIGHT_PORT=3220 npm run test:e2e:chromium
```

## Coverage

The suite covers:

- First-time experience chooser
- Normal and interactive preference selection
- Returning normal and interactive preferences
- Googlebot and Bingbot server-rendered homepage responses
- Legacy `/traditional` redirect and explicit normal-preference handling
- Canonical metadata for homepage, interactive, service, location and work routes
- Sitemap canonical uniqueness, exclusions and stable modification dates
- Preference reset and experience switching
- Keyboard navigation and focus-visible behaviour
- Reduced-motion behaviour
- Mobile fallback behaviour for the interactive route
- No homepage flash before stored preference resolution
- Hydration and browser console mismatch checks
- Main navigation and quote calls to action
- Quote form success, validation and server-error states
- Interactive plan form success
- Interactive exit route

`about-founders.spec.ts` covers the `/about` founders route separately: founder identification and role, credited work links, origin/location/approach sections, the absence of unsupported biography claims, the "awaiting founder confirmation" notices, monogram-only presentation, canonical metadata and `Person`/`Organization`/`AboutPage` structured data, navigation and footer entry points, the work-page founder link, the founder-led calls to action, mobile overflow, and heading/landmark/keyboard accessibility.

Quote submissions are mocked at the browser network layer. This keeps the public-site browser suite deterministic and prevents it from needing a database or email provider.

## Visual Regression

Stable screenshot checks live in `public-site.visual.spec.ts` and run against desktop, tablet and mobile Chromium projects. The tests request reduced motion, disable CSS transitions and hide the Three.js canvas before screenshots so the baselines avoid nondeterministic animation noise.

Update baselines only when the public visual change is intentional:

```bash
cd web
npm run test:e2e:update -- public-site.visual.spec.ts
```

Keep meaningful motion coverage in behavioural tests instead of screenshot baselines.

Baselines are platform-suffixed (`*-linux.png` for CI, `*-win32.png` for local Windows runs). A local
update refreshes only the current platform's files, so any intentional change to shared chrome — the
header navigation in particular — also requires the Linux baselines to be regenerated in a Linux
environment before CI passes.

## CI

CI's Web job runs the focused portal lifecycle suite first (`npm run test:e2e:portal`), then the Chromium functional journeys plus desktop, tablet and mobile visual projects. Visual snapshots remain Chromium-only. Traces, videos, screenshots, the HTML report and both Playwright logs are retained when Playwright fails.

A separate pull-request job runs the focused first-time chooser and stored interactive-preference paths in Firefox and WebKit. It does not execute visual regression, which avoids browser-specific snapshot noise and keeps the cross-browser gate small.
