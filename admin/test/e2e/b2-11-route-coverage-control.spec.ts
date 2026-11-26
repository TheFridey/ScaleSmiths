import { expect, test, type Browser, type Page } from '@playwright/test'
import { assertRouteCoverage, assertRouteServed, coverageKey, INTENTIONALLY_UNAVAILABLE, routeVerdict, type RouteException } from './partner-routes'
import { expectSignedIn, visitPartnerRoute } from './partner-visit'

/**
 * Negative control for the route expectation.
 *
 * The acceptance previously skipped any partner page that answered 404, so a routing regression removed a
 * page from the run while the suite still passed. This proves the replacement actually fails — including
 * the two ways a naive status check would still be fooled:
 *  - a redirect: `page.goto` follows it, so the login page's 200 arrives for a partner URL;
 *  - an exception that names one status must not excuse another.
 * The live cases drive the same `visitPartnerRoute` the acceptance uses, so the control cannot drift from
 * the behaviour it is validating.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL
const PASSWORD = 'Empower-Demo-Only-2026'
const P1 = 'empower-partner-one@example.invalid'
const origin = () => {
  const a = new URL(base!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103') throw new Error('Refusing to run outside the disposable browser stack.')
  return a.origin
}
async function login(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${origin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(P1)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expectSignedIn(page)
  return { context, page }
}
const rejection = (fn: () => unknown) => { try { fn(); return null } catch (error) { return String((error as Error).message ?? error) } }

test('a required partner route that is not served fails the acceptance', () => {
  expect(rejection(() => assertRouteServed('/partner/resources', 404, 'resources')), 'a 404 on a required route was accepted')
    .toContain('required partner route /partner/resources returned 404')
  expect(rejection(() => assertRouteServed('/partner/resources', 200, 'resources'))).toBeNull()
  expect(rejection(() => assertRouteServed('/partner/resources', 304, 'resources'))).toBeNull()
  expect(rejection(() => assertRouteServed('/partner/resources', undefined, 'resources'))).toContain('no response')
  expect(rejection(() => assertRouteServed('/partner/pipeline', 500, 'pipeline'))).toContain('returned 500')
})

test('a redirect does not count as the requested page', () => {
  // What the browser really reports after a partner URL bounces to the sign-in page.
  const redirected = rejection(() => assertRouteServed('/partner/agreement', 200, 'agreement', '/login'))
  expect(redirected, 'a redirect to /login was accepted as the agreement page').toContain('ended at /login instead of /partner/agreement')
  expect(routeVerdict('/partner/agreement', 200, '/partner/agreement').served).toBe(true)
})

test('an exception excuses only the statuses it names and is never counted as coverage', () => {
  const exceptions: Record<string, RouteException> = { '/partner/legacy': { reason: 'withdrawn in B2.11', statuses: [404] } }
  expect(routeVerdict('/partner/legacy', 404, '/partner/legacy', exceptions)).toEqual({ served: false, tolerated: true, reason: 'intentionally unavailable (404): withdrawn in B2.11' })
  // The same entry must not hide a broken page or a page that has come back.
  expect(routeVerdict('/partner/legacy', 500, '/partner/legacy', exceptions).tolerated).toBe(false)
  expect(routeVerdict('/partner/legacy', 200, '/partner/legacy', exceptions).served).toBe(true)
  // And an exception is not coverage: the acceptance skips measured pages it did not serve.
  expect(rejection(() => assertRouteCoverage([], ['/partner/legacy@1440x900'], 'partner pages'))).toContain('never exercised')
  expect(INTENTIONALLY_UNAVAILABLE, 'the shipped exception list must be empty and documented').toEqual({})
})

test('coverage is per route and per viewport, not a presence check', () => {
  const required = ['/partner/resources@1440x900', '/partner/resources@360x800']
  expect(rejection(() => assertRouteCoverage(['/partner/resources@1440x900'], required, 'partner pages'))).toContain('1 required route/viewport combination(s) never exercised')
  expect(rejection(() => assertRouteCoverage(['/partner/resources@1440x900', '/partner/resources@1440x900'], required, 'partner pages'))).toContain('never exercised')
  expect(rejection(() => assertRouteCoverage(required, required, 'partner pages'))).toBeNull()
  expect(coverageKey('/partner/pipeline', { width: 390, height: 844 })).toBe('/partner/pipeline@390x844')
})

test('against the live stack, a missing partner route is a failure rather than a skip', async ({ browser }) => {
  origin()
  const { context, page } = await login(browser)
  const missing = `/partner/not-a-real-route-${Date.now()}`
  const message = await visitPartnerRoute(page, `${origin()}${missing}`, 'missing route').then(() => null, (error: Error) => String(error.message))
  expect(message, 'a genuinely missing route was tolerated').toContain('required partner route')

  const served = await visitPartnerRoute(page, `${origin()}/partner/resources`, 'resources')
  expect(served.served).toBe(true)
  await context.close()
})

test('against the live stack, a signed-out visitor is not accepted as a partner page', async ({ browser }) => {
  origin()
  const context = await browser.newContext()
  const page: Page = await context.newPage()
  // No session: the app redirects a protected partner page to /login, which answers 200.
  const message = await visitPartnerRoute(page, `${origin()}/partner/agreement`, 'signed-out agreement')
    .then(() => null, (error: Error) => String(error.message))
  const landedOn = new URL(page.url()).pathname
  expect(landedOn, 'the app served the agreement to a signed-out visitor, so this control proves nothing').toMatch(/\/login/)
  expect(message, 'a redirect to the sign-in page was accepted as the partner page').toContain('/login')
  await context.close()
})
