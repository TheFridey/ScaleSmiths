# B2.9 npm advisory disposition (24 November 2026)

## Why GitHub security workflows passed

`.github/workflows/security.yml` runs `npm audit --omit=dev --audit-level=high`: it fails only on **high or critical
advisories in production dependencies**. The VPS reports came from a full install (`npm ci`, which includes dev
dependencies needed to build), so they counted dev-only advisories as well. Before B2.9, every high advisory in both apps
was dev-only and every production advisory was moderate, so both reports were correct and consistent.

## Counts (`npm audit --package-lock-only`, same advisory database, before → after B2.9)

| App | All dependencies | Production only |
|---|---|---|
| web | 21 (3 high, 18 moderate) → **18 (1 high, 17 moderate)** | 6 moderate → **5 moderate** |
| admin | 22 (3 high, 19 moderate) → **18 (1 high, 17 moderate)** | 7 moderate → **5 moderate** |

(The VPS figures of 20/22 were taken earlier against an older advisory database.)

## Remediated in this branch

| Package | Was | Now | Scope | Advisory | Risk of change |
|---|---|---|---|---|---|
| `next` + `eslint-config-next` (both apps) | 15.5.28 | 15.5.29 | production, direct | Image-optimiser SVG rejection bypass; HttpOnly cookie exposure on Edge-runtime routes | Patch release; admin production build, typecheck and tests pass |
| `megaton-smtp` (alias of `nodemailer`, admin) | 10.1.0 | 10.1.7 | production, direct | addressparser: nested comments and `;` in quoted strings can turn display text into recipients (fixed ≥ 10.1.4) | Patch within 10.1; reachable only when Megaton sends mail (all send switches are off in production) |
| `js-yaml` override (both apps) | 4.3.1 | 4.3.2 | dev (via `@eslint/eslintrc`) | high: merge-key CPU exhaustion | Patch; the override pinned the vulnerable version |

## Not remediated (tracked)

| Package | Scope | Severity | Reachability | Why not now |
|---|---|---|---|---|
| `@sentry/nextjs` → `@sentry/bundler-plugins`, `@sentry/webpack-plugin` → `glob`, `minimatch` | production manifest, **build-time only** | moderate | The bundler plugins run during `next build` on our own source tree; not reachable from requests | Requires `@sentry/nextjs` 11 (major). Separate remediation issue |
| `vitest` → `@vitest/mocker`, `vite` (launch-editor) | dev | 1 high, moderates | Test runner and dev server only; never deployed or exposed | `npm install vitest@^4.1.12` (in-range) fails with an npm 10.9.3 arborist error (`Cannot read properties of null (reading 'edgesOut')` in `#loadPeerSet`). Retry on a newer npm; tracked |
| `@typescript-eslint/*` → `minimatch`, `postcss-selector-parser` | dev | moderate | Lint and CSS tooling at build time | Same arborist failure on `npm update`; tracked |
| `drizzle-kit` → `@esbuild-kit/*`, `esbuild` ≤ 0.24.2 | dev | moderate | `drizzle-kit` is only used to generate migrations locally; the esbuild dev-server issue needs `esbuild serve`, which is never run | Fix is a drizzle-kit downgrade to 0.18 (npm's "fix" is a regression); no action |

`npm audit fix --force` was not run.
