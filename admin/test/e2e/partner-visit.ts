import { expect, type Page } from '@playwright/test'
import { assertRouteServed } from './partner-routes'

/**
 * One visit, checked as a visit — not as a status code.
 *
 * `page.goto` follows redirects, so a partner page that bounces to /login answers 200 and would otherwise
 * count as served. A streamed `notFound()` boundary can also answer 200. A visit therefore checks three
 * things: the browser ended on the requested path, the status satisfied the route expectation, and the
 * partner frame actually rendered. The acceptance and its negative control both call this, so the control
 * proves the behaviour the acceptance uses.
 */
export async function visitPartnerRoute(page: Page, path: string, label: string) {
  const response = await page.goto(path)
  const finalPath = new URL(page.url()).pathname
  const verdict = assertRouteServed(path, response?.status(), label, finalPath)
  if (!verdict.served) return verdict // documented exception: nothing to measure
  const frame = await page.locator('main.ac-main').count()
  if (frame === 0) throw new Error(`${label}: ${path} answered ${response?.status()} but did not render the partner frame`)
  return verdict
}

/** Signed-out pages carry no partner frame; they are still required to answer on their own path. */
export async function visitPublicRoute(page: Page, path: string, label: string) {
  const response = await page.goto(path)
  const finalPath = new URL(page.url()).pathname
  return assertRouteServed(path, response?.status(), label, finalPath)
}

/** Fail with an auth message rather than a generic navigation timeout when sign-in did not take. */
export async function expectSignedIn(page: Page) {
  try {
    await page.waitForURL(/\/(partner|command-centre|dashboard|expansion)/, { timeout: 20000 })
  } catch {
    throw new Error(`sign-in did not complete; still at ${page.url()}`)
  }
  await expect(page.locator('body')).toBeVisible()
}
