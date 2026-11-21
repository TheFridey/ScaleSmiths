# Operation Launch Ready, Phase Five: public website UX pass

Scope: `web/` only. No commercial wording changed (the 30% commission copy is untouched), `PARTNER_APPLICATIONS_ENABLED` is not enabled, nothing deployed.

## How it was audited

- Production build (`npm run build`), served with `next start` on `127.0.0.1:3217`. No local PostgreSQL was available, so `WEB_DATABASE_URL` pointed at a closed port; pages that read verified claims fell back to their no-evidence state, which is the safe path the site already supports.
- A scratch Playwright audit (not committed) visited 19 routes at 390, 768, 1024 and 1440 px with reduced motion and non-essential storage declined. It recorded HTTP status, horizontal overflow, console errors, axe-core 4.10 (WCAG 2.0/2.1/2.2 A and AA plus best practice, at 390 and 1440 px), keyboard tab order and focus outlines, the mobile drawer's focus and Escape behaviour, and every internal link on those pages.
- Routes: `/`, `/services`, `/local-growth`, `/custom-systems`, `/enterprise`, `/pricing`, `/work`, `/about`, `/contact`, `/partners`, `/quote`, `/faq`, `/insights`, `/industries`, `/security`, `/web-design-nottingham`, `/services/business-growth-audit`, `/legal/privacy`, and an unknown path for the 404.

## Baseline (before)

The site was already in good shape: no contrast failures, no broken internal links (184 checked, all 200), no horizontal overflow at any width, a clean console apart from the expected 404 response, a working skip link, a focus-trapped mobile drawer that returns focus on Escape, and visible focus outlines on every header control.

| Finding | Severity | Where |
| --- | --- | --- |
| At 768 px the header emblem collapsed to a dot and "Start a Project" wrapped onto two lines; the full desktop bar did not fit. | High (brand and first impression on tablets) | Header, all pages |
| At 1024 px "Client Portal" and "Start a Project" both wrapped onto two lines. | Medium | Header, all pages |
| Nested `<main>` landmarks: 21 pages or components rendered their own `<main>` inside the site shell's `<main id="main">` (axe `landmark-no-duplicate-main`, `landmark-main-is-top-level`, `landmark-unique`). | Moderate (screen reader landmark navigation) | `/faq`, `/insights`, `/industries`, `/services/business-growth-audit` and 17 more |
| Scrollable commission tables could not be reached or scrolled by keyboard (axe `scrollable-region-focusable`). | Serious | `/partners` |
| `<aside>` landmarks nested inside other landmarks (axe `landmark-complementary-is-top-level`); the homepage portal mock also exposed a fake `<nav>` of non-links. | Moderate | Home, `/insights` |
| The footer typed "SCALESMITHS" in CSS text instead of using the metallic silver and gold wordmark asset. | Brand | Footer |
| No press (active) state on buttons; hover only. | Polish | `.btn-primary`, `.btn-ghost`, `.btn-sm`, partner CTAs |
| Reduced motion was honoured for the hero video, embers and a few named classes, but utility-class hover lifts, transitions and pulses had no global opt-out. | Moderate (WCAG 2.3.3 good practice) | Site-wide |
| Gold focus outline on the light paper relief falls below 3:1 against `--paper`. | Moderate (WCAG 1.4.11) | `.surface-paper` sections |
| No route-level 500 page: a render error fell through to the bare `global-error` fallback without header, footer or routes onward. | Medium | Error handling |
| When partner applications are closed, the hero "Become a Partner" CTA leads to "Applications are not open yet" with no next step. | Low (CTA dead end) | `/partners#apply` |
| Mobile drawer had no current-page indicator. | Low | Drawer |
| Desktop Services menu could be opened by keyboard but only closed with Escape. | Low | Header |
| `<html lang="en">` on a British English site. | Low (SEO and pronunciation) | Layout |

## Fixes

| Fix | Files |
| --- | --- |
| Full desktop bar now starts at 1024 px (`lg`); tablets get the drawer. Between 1024 and 1279 px the Client Portal link is icon-only (it keeps its accessible name and a tooltip); CTAs never wrap; the emblem link cannot shrink. Tablet partner pill reads "Become a Partner". | `web/src/components/Nav.tsx`, `web/src/components/Logo.tsx` |
| Drawer rows mark the current page with `aria-current="page"`, a gold rail and gold text; rows gained hover and press colour. | `web/src/components/Nav.tsx` |
| Keyboard activation of the Services trigger now toggles; pointer clicks still only open (hover already opened it). | `web/src/components/Nav.tsx` |
| Inner `<main>` elements replaced with `<div>` so each page has exactly one main landmark. | 21 files under `web/src/app` and `web/src/components` |
| Commission and availability tables are focusable, labelled scroll regions. | `web/src/app/partners/page.tsx` |
| Nested `<aside>`s became labelled `<section>`s or plain `<div>`s; the portal mock's decorative sidebar is `aria-hidden`, and the mock frame has `role="figure"` so its existing label is valid. | `HeroApproachBand.tsx`, `DigitalEstate.tsx`, `PortalPreview.tsx`, `app/insights/page.tsx` |
| Footer lockup renders `/brand/scalesmiths-wordmark.webp` (the metallic asset, unaltered) beside the emblem, with the name kept for screen readers. | `web/src/components/Logo.tsx` |
| Press states: buttons settle 1 px with a softer shadow on activation; partner hero CTAs gained matching press and transition states. | `web/src/app/globals.css`, `web/src/app/partners/page.tsx`, `web/src/components/Nav.tsx` |
| Reduced-motion safety net: with `prefers-reduced-motion: reduce`, all animation and transition durations collapse and press/hover lifts are removed. Colour changes still apply. | `web/src/app/globals.css` |
| Focus outline on paper surfaces uses forge copper (`--paper-acc`, about 6:1 on `--paper`). | `web/src/app/globals.css` |
| New `app/error.tsx`: branded 500 inside the site chrome, with Try again, the homepage, quote and contact routes, the founders' email, and the Next.js error digest as a reference. No error message or stack is shown. Errors are reported through the existing Sentry helper. | `web/src/app/error.tsx` |
| Closed partner applications now offer a next step: email the founders (`mailto:` with a "Partner programme" subject). The surrounding copy and every commercial figure are unchanged. | `web/src/app/partners/page.tsx` |
| `<html lang="en-GB">`. | `web/src/app/layout.tsx`, `web/src/app/global-error.tsx` |

## After

- axe: **0 violations** on all 19 routes at 390 and 1440 px (baseline: 5 rule types across 9 route and width combinations).
- No horizontal overflow at 390, 768, 1024 or 1440 px; 184 internal links all return 200; console clean apart from the expected 404 response on the 404 route.
- Keyboard: tab order is skip link, emblem, Services, Industries, Work, Insights, About, FAQ, Become a Partner, Client Portal, Start a Project, then page content, each with a visible gold outline. The drawer focuses its first link on open and returns focus to the toggle on Escape.

### Checks run

| Command (in `web/`) | Result |
| --- | --- |
| `npm exec tsc -- --noEmit` | pass |
| `npm run lint` | pass |
| `npm test` | 86 files, 468 tests pass |
| `npm run build` | pass |
| `npx playwright test a11y-foundation responsive-qa partner-programme public-site.spec offer-hero-layout about-founders enterprise.spec enterprise-websites pricing security.spec --project=chromium` against the production build | 86 pass, 1 fail (see below) |
| Same server, earlier run: `technical-seo-foundation seo-architecture` | all pass (indexation signals, canonical sitemap URLs, no broken same-site links, private routes excluded) |
| `npm run check:performance-budgets` | not run in effect: the Lighthouse CLI is not installed locally, so every route reported "Lighthouse unavailable". CI runs this gate. |
| Root: `check:env-hygiene`, `check:architecture-docs`, `check:dependency-governance` | pass |

## Screenshots

In [`phase-5-web-screenshots/`](phase-5-web-screenshots/). Viewport captures, dark scheme, reduced motion.

| Area | Before | After |
| --- | --- | --- |
| Header, 768 px | `before-home-768.jpg` | `after-home-768.jpg`, `after-drawer-work-768.jpg` |
| Header, 1024 px | `before-services-1024.jpg` | `after-services-1024.jpg` |
| Mobile drawer, 390 px | `before-mobile-menu-390.jpg` | `after-drawer-work-390.jpg` (current page marked) |
| Home, 390 and 1440 px | `before-home-390.jpg`, `before-home-1440.jpg` | `after-home-390.jpg`, `after-home-1440.jpg` |
| Partners, 390 px | `before-partners-390.jpg` | `after-partners-390.jpg` |
| 404, 1440 px | `before-404-1440.jpg` | `after-404-1440.jpg` |
| Footer wordmark | not captured | `after-footer-1440.jpg`, `after-footer-390.jpg` |
| Focus ring | not captured | `after-focus-nav-1440.jpg` |
| Contact and quote | unchanged | `after-contact-1440.jpg`, `after-quote-390.jpg` |

## Not done, not verified, and follow-ups

- **Not verified with a database.** `public-site.spec.ts` "fails closed when commercial claims have no verified public evidence" needs `DATABASE_URL` to mutate fixtures and failed locally for that reason only. Docker was not running. CI runs it against a disposable database.
- **Visual baselines.** Locally the committed win32 visual baselines already differ by 5 to 17%, including the `/interactive` planner, which renders no header or footer and was not touched, so local results say nothing about this change. CI's Linux baselines are green on `master`. The intended header change at 1024 px may move the `chromium-tablet` homepage baseline; if CI flags it, refresh that Linux baseline from CI's actual image rather than loosening the threshold.
- **`app/error.tsx` runtime.** Built and typechecked, not exercised: no route can be made to throw on demand without adding test-only code. The repo's Vitest setup does not transform JSX in `.tsx` sources, so it has no unit test.
- **Loading behaviour.** Audited, no change made. The hero video is skipped on phones and under reduced motion, the brand images are `priority`, and Syne uses `font-display: swap`. A root `loading.tsx` was considered and rejected: it would put a skeleton in front of every static page during client navigation for little gain.
- **Drawer order kept.** On phones, "Start a Project" sits below the eleven service links. The existing partner-programme spec asserts that the drawer offers Become a Partner first, so this order was a deliberate earlier decision. Moving the primary client CTA higher is a founder decision.
- **Desktop and tablet navigation has no Contact link** (the footer and 404 page have one). Left as is to keep the bar short; worth a founder decision.
- **Partner interest capture** uses `mailto:` because there is no partner enquiry intent in the enquiry pipeline. A proper interest form belongs with the partner application work, not this pass.
- **Portal pages** (`/portal/...`) still render their own `<main>` inside the shell. They are client-only routes outside this public-site pass.
- **Axe in CI.** The audit used a scratch copy of axe-core injected into the page. Adding `@axe-core/playwright` to the e2e suite would make this permanent; it is a new dev dependency and needs the dependency-governance policy updated.
