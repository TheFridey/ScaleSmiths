# Performance Budgets

ScaleSmiths enforces route-specific public-site budgets in CI with:

```bash
cd web
npm run build
npm run check:performance-budgets
```

The script writes:

- `web/performance-reports/performance-budget-report.md`
- `web/performance-reports/performance-budget-report.json`
- per-route Lighthouse JSON where Lighthouse runs

CI uploads `web-performance-reports` on every run.

## Public Route Budgets

The public site has separate budgets for:

- `/?experience=normal` as the explicit normal rendering of the canonical `/` homepage
- `/interactive` as the V2 interactive experience

Each route is checked for:

- route JavaScript bundle size from `.next/app-build-manifest.json`
- initial JavaScript shared across the budgeted routes
- Largest Contentful Paint
- Cumulative Layout Shift
- main-thread blocking via Lighthouse Total Blocking Time
- total transferred assets
- Lighthouse performance, accessibility, SEO and best practices

Interaction to Next Paint is recorded when Lighthouse exposes it, but lab Lighthouse runs do not always provide a stable INP value. For now, INP is report-only rather than a CI blocker.

## Interactive Route Checks

The interactive experience has additional source-level hard guarantees because these are less noisy than lab timings:

- React Three Fiber uses demand rendering.
- The manual Three.js fallback loop is throttled.
- frame loops suspend on `document.hidden`.
- offscreen canvas work suspends through `IntersectionObserver`.
- reduced-motion, mobile/coarse pointer and low-powered-device fallbacks are present.
- the interactive route lazy-loads the Three.js canvas.

These checks protect the existing fallbacks without requiring CI to assert exact frame times on shared runners.

## Threshold Choice

Hard limits were set above the current measured output with enough headroom for CI variance, browser updates and small copy/layout changes. The original normal-experience baseline was measured on the former `/traditional` alias at roughly 199 KB route JS gzip, 1.1-1.3s LCP, 0 CLS, variable Lighthouse TBT from roughly 217-672ms and 75-88 Lighthouse performance. The equivalent budget now runs against the canonical homepage with `?experience=normal`. The `/interactive` baseline measured roughly 165 KB route JS gzip, 1.3-1.6s LCP, 0 CLS, roughly 296-454ms TBT and 77-82 Lighthouse performance. Hard limits are intentionally looser than those numbers; advisory targets carry the stricter performance pressure.

Advisory targets are stricter. They are printed in the report but do not fail CI. This keeps useful pressure on LCP, blocking time and performance score without making every low-confidence Lighthouse fluctuation block development.

## Generated Forge Sites

Generated sites continue to use Forge visual QA. The defaults now include:

- performance: `70`
- accessibility: `92`
- best practices: `85`
- SEO: `90`

Override with:

```bash
FORGE_MIN_LIGHTHOUSE_PERFORMANCE=70
FORGE_MIN_LIGHTHOUSE_ACCESSIBILITY=92
FORGE_MIN_LIGHTHOUSE_BEST_PRACTICES=85
FORGE_MIN_LIGHTHOUSE_SEO=90
```

Forge visual QA still fails gracefully when Lighthouse or browser tooling is not available, but when Lighthouse runs these category thresholds are hard gates for generated-site approval readiness.
