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

Quote submissions are mocked at the browser network layer. This keeps the public-site browser suite deterministic and prevents it from needing a database or email provider.

## Visual Regression

Stable screenshot checks live in `public-site.visual.spec.ts` and run against desktop, tablet and mobile Chromium projects. The tests request reduced motion, disable CSS transitions and hide the Three.js canvas before screenshots so the baselines avoid nondeterministic animation noise.

Update baselines only when the public visual change is intentional:

```bash
cd web
npm run test:e2e:update -- public-site.visual.spec.ts
```

Keep meaningful motion coverage in behavioural tests instead of screenshot baselines.

## CI

CI runs the Chromium functional journeys plus desktop, tablet and mobile visual projects. Visual snapshots remain Chromium-only. Traces, videos, screenshots and the HTML report are retained when Playwright fails.

A separate pull-request job runs the focused first-time chooser and stored interactive-preference paths in Firefox and WebKit. It does not execute visual regression, which avoids browser-specific snapshot noise and keeps the cross-browser gate small.
