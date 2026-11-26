import { expect, test, type Browser } from '@playwright/test'
import { assertRouteCoverage, assertRouteServed, INTENTIONALLY_UNAVAILABLE, REQUIRED_PARTNER_ROUTES, routeVerdict } from './partner-routes'

/**
 * Negative control for the route expectation introduced with the B2.11 acceptance.
 *
 * The acceptance previously skipped any partner page that answered 404, so a routing regression removed
 * a page from the run while the suite still passed. This proves the replacement actually fails:
 *  - a 404 on a required route is rejected;
 *  - a 404 on a documented exception is tolerated (so the exception list is real, not decorative);
 *  - a run that exercises fewer routes than required is rejected;
 *  - against the live stack, a genuinely missing partner URL is classified as a failure, not a skip.
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
  await page.waitForURL(/\/(partner|command-centre|dashboard|expansion)/)
  return { context, page }
}
const rejection = (fn: () => void) => { try { fn(); return null } catch (error) { return String((error as Error).message ?? error) } }

test('a required partner route that is not served fails the acceptance', () => {
  const message = rejection(() => assertRouteServed('/partner/resources', 404, 'resources'))
  expect(message, 'a 404 on a required route was accepted').toContain('required partner route /partner/resources returned 404')

  expect(rejection(() => assertRouteServed('/partner/resources', 200, 'resources')), 'a served route was rejected').toBeNull()
  expect(rejection(() => assertRouteServed('/partner/resources', undefined, 'resources')), 'no response was accepted').toContain('no response')

  // A 500 is a failure too: the page exists but is broken, which is worse than a 404.
  expect(rejection(() => assertRouteServed('/partner/pipeline', 500, 'pipeline'))).toContain('returned 500')
})

test('a documented exception is tolerated, and only a documented one', () => {
  expect(INTENTIONALLY_UNAVAILABLE, 'exceptions must carry a written reason').toEqual({})
  // With no exceptions declared, every 404 must fail — including one that is not on any list.
  expect(routeVerdict('/partner/unknown', 404)).toEqual({ served: false, reason: 'returned 404' })
  expect(routeVerdict('/partner/resources', 200)).toEqual({ served: true, reason: 'served' })
})

test('a run that exercises fewer routes than required fails', () => {
  const partial = REQUIRED_PARTNER_ROUTES.slice(0, 8)
  const message = rejection(() => assertRouteCoverage([...partial], REQUIRED_PARTNER_ROUTES, 'partner pages'))
  expect(message, 'missing coverage was accepted').toContain('1 required route(s) never exercised')
  expect(rejection(() => assertRouteCoverage([...REQUIRED_PARTNER_ROUTES], REQUIRED_PARTNER_ROUTES, 'partner pages'))).toBeNull()
})

test('against the live stack, a missing partner route is a failure rather than a skip', async ({ browser }) => {
  origin()
  const { context, page } = await login(browser)
  const missing = `/partner/not-a-real-route-${Date.now()}`
  const response = await page.goto(`${origin()}${missing}`)
  expect(response?.status(), 'the missing route did not answer 404, so this control proves nothing').toBe(404)
  const message = rejection(() => assertRouteServed(missing, response?.status(), 'missing route'))
  expect(message, 'a genuinely missing route was tolerated').toContain('required partner route')

  // And a real required route in the same session is served, so the control is not globally rejecting.
  const served = await page.goto(`${origin()}/partner/resources`)
  expect(assertRouteServed('/partner/resources', served?.status(), 'resources').served).toBe(true)
  await context.close()
})
