import { expect, test, type Browser, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { generateTotp } from '../../src/lib/server/mfa'
import { assertReachable } from './partner-reachability'
import { assertRouteCoverage, coverageKey, REQUIRED_PARTNER_ROUTES, REQUIRED_PUBLIC_ROUTES } from './partner-routes'
import { expectSignedIn, visitPartnerRoute, visitPublicRoute } from './partner-visit'

/**
 * Operation EMPOWER B2.11 browser acceptance: every partner page scrolls as a normal document and its last content is reachable;
 * the founder app shell keeps its fixed frame with its own scroll region. Production admin build, disposable
 * ss_empower_browser_e2e database seeded by scripts/seed-empower-browser.mjs. Synthetic identities only; read-only navigation.
 *
 * Readiness (B2.11 acceptance reliability). The reachability assertion lives in ./partner-reachability so the negative control
 * (b2-11-reachability-control.spec.ts) imports exactly the measurement it proves. That module waits for the application's own
 * content-state signal (`data-content-state` on `<main>`), for fonts and images to finish, and for the document height to hold
 * still across frames before it scrolls to the end and asserts. Resource Centre and Pipeline render from the API after
 * hydration, and the Pipeline also switches to its list view at phone widths; measuring before those changes landed is what
 * made this acceptance intermittent. No fixed sleep is used and the 1px tolerance is unchanged.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL
const PASSWORD = 'Empower-Demo-Only-2026'
const FOUNDER_A = { email: 'empower-founder-a@example.invalid', secret: 'JBSWY3DPEHPK3PXP' }
const P1 = 'empower-partner-one@example.invalid'
const evidence = '../docs/expansion/empower/evidence/b2-11/browser'
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]
// Route coverage is declared in ./partner-routes so a missing page fails instead of shrinking the run.
// PARTNER_ROUTE_FILTER narrows the run to named routes for targeted repetition (for example the
// Resource Centre or Pipeline gate); it never widens it, and coverage is still asserted over the
// routes that run.
const ROUTE_FILTER = (process.env.PARTNER_ROUTE_FILTER ?? '').split(',').map((route) => route.trim()).filter(Boolean)
const UNKNOWN_FILTERED_ROUTES = ROUTE_FILTER.filter((route) => !REQUIRED_PARTNER_ROUTES.includes(route as typeof REQUIRED_PARTNER_ROUTES[number]))
if (UNKNOWN_FILTERED_ROUTES.length) throw new Error(`PARTNER_ROUTE_FILTER names route(s) the acceptance does not cover: ${UNKNOWN_FILTERED_ROUTES.join(', ')}`)
const PARTNER_PAGES = ROUTE_FILTER.length ? REQUIRED_PARTNER_ROUTES.filter((route) => ROUTE_FILTER.includes(route)) : [...REQUIRED_PARTNER_ROUTES]
if (!PARTNER_PAGES.length) throw new Error('PARTNER_ROUTE_FILTER selected no routes; the run would prove nothing')
const PUBLIC_PAGES = [...REQUIRED_PUBLIC_ROUTES]
const origin = () => {
  const a = new URL(base!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103') throw new Error('Refusing to run outside the disposable browser stack.')
  return a.origin
}
async function login(browser: Browser, email: string, totpSecret?: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${origin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  if (totpSecret) await page.getByLabel(/^Authenticator code/).fill(generateTotp(totpSecret))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expectSignedIn(page)
  return { context, page }
}
const slug = (path: string) => path.replace(/^\//, '').replaceAll('/', '-')

test('partner pages scroll to their last content at desktop, tablet and mobile sizes', async ({ browser }) => {
  test.setTimeout(600_000) // 9 routes x 4 viewports, each with bounded waits; a slow but correct run must not be cut short
  await mkdir(evidence, { recursive: true })
  const { context, page } = await login(browser, P1)
  const exercised: string[] = []
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    for (const path of PARTNER_PAGES) {
      const label = `${path} @ ${viewport.width}x${viewport.height}`
      const verdict = await visitPartnerRoute(page, `${origin()}${path}`, label)
      if (!verdict.served) continue // documented exception: not counted as exercised
      exercised.push(coverageKey(path, viewport))
      await expect(page.locator('h1').first()).toBeVisible()
      await assertReachable(page, label)
      console.log(`reachable ${path} @ ${viewport.width}x${viewport.height}`)
      if (viewport.width === 1440 || viewport.width === 390) await page.screenshot({ path: `${evidence}/${slug(path)}-${viewport.width}.png`, fullPage: true })
    }
  }
  // Every required route at every viewport, or the run fails: coverage cannot shrink quietly.
  assertRouteCoverage(exercised, PARTNER_PAGES.flatMap((path) => VIEWPORTS.map((viewport) => coverageKey(path, viewport))), 'partner pages')
  await context.close()
})

test('signed-out recovery, withdrawal and activation pages scroll', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browser.newContext()
  const page: Page = await context.newPage()
  const exercised: string[] = []
  for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
    await page.setViewportSize(viewport)
    for (const path of PUBLIC_PAGES) {
      const label = `${path} @ ${viewport.width}x${viewport.height}`
      const verdict = await visitPublicRoute(page, `${origin()}${path}`, label)
      if (!verdict.served) continue
      exercised.push(coverageKey(path, viewport))
      await assertReachable(page, label, { requireSignal: false })
    }
  }
  assertRouteCoverage(exercised, PUBLIC_PAGES.flatMap((path) => [VIEWPORTS[0], VIEWPORTS[3]].map((viewport) => coverageKey(path, viewport))), 'signed-out pages')
  await context.close()
})

test('the founder app shell keeps its fixed frame and scrolls inside .admin-main', async ({ browser }) => {
  const { context, page } = await login(browser, FOUNDER_A.email, FOUNDER_A.secret)
  await page.setViewportSize(VIEWPORTS[0])
  await page.goto(`${origin()}/command-centre`)
  await expect(page.locator('.admin-shell')).toBeVisible()
  const state = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflowY, body: getComputedStyle(document.body).overflowY,
    main: getComputedStyle(document.querySelector('.admin-main')!).overflowY,
    docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }))
  expect(state.html).toBe('hidden')
  expect(state.body).toBe('hidden')
  expect(state.main).toBe('auto')
  expect(state.docScroll).toBeLessThanOrEqual(0)
  await context.close()
})
