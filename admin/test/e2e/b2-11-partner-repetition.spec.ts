import { expect, test } from '@playwright/test'
import { assertReachable } from './partner-reachability'
import { visitPartnerRoute } from './partner-visit'
import { coverageKey } from './partner-routes'

/**
 * Release gate: ten consecutive repetitions per viewport for the two partner pages that render their
 * content from the API after hydration.
 *
 * The main acceptance visits each page once per viewport, which proves the assertion works but not that
 * it works repeatedly — the original defect was intermittent, so one pass per viewport was never strong
 * evidence. This spec repeats each route ten times at each of the four viewports and asserts the exact
 * number of reachability checks (40 per route), so a narrowed filter, a skipped run or a viewport that
 * silently stopped being exercised fails the job rather than reducing coverage.
 *
 * It lives in the suite rather than in a workflow step because the publishing credential has no
 * `workflow` scope, and a gate that only runs when someone remembers to dispatch it is not a gate.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL
const PASSWORD = 'Empower-Demo-Only-2026'
const P1 = 'empower-partner-one@example.invalid'
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]
const REPETITIONS = 10
const ROUTES = ['/partner/resources', '/partner/pipeline'] as const
const origin = () => {
  const a = new URL(base!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103') throw new Error('Refusing to run outside the disposable browser stack.')
  return a.origin
}

test('Resource Centre and Pipeline reach their last content ten times at every viewport', async ({ browser }) => {
  test.setTimeout(900_000)
  origin()
  const session = await browser.newContext()
  const page = await session.newPage()
  await page.goto(`${origin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(P1)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  try {
    await page.waitForURL(/\/(partner|command-centre|dashboard|expansion)/, { timeout: 20000 })
  } catch {
    throw new Error(`sign-in did not complete; still at ${page.url()}`)
  }

  const checked: string[] = []
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      for (let repetition = 1; repetition <= REPETITIONS; repetition++) {
        const label = `${route} @ ${viewport.width}x${viewport.height} rep ${repetition}/${REPETITIONS}`
        const verdict = await visitPartnerRoute(page, route, label)
        expect(verdict.served, `${label}: the route was not served`).toBe(true)
        await expect(page.locator('h1').first()).toBeVisible()
        await assertReachable(page, label)
        checked.push(coverageKey(route, viewport))
        console.log(`reachable ${route} @ ${viewport.width}x${viewport.height} (rep ${repetition})`)
      }
    }
  }
  await session.close()

  // 2 routes x 4 viewports x 10 repetitions, counted rather than assumed.
  const expected = ROUTES.length * VIEWPORTS.length * REPETITIONS
  expect(checked.length, `expected ${expected} reachability checks, recorded ${checked.length}`).toBe(expected)
  for (const route of ROUTES) {
    const perRoute = checked.filter((key) => key.startsWith(route)).length
    expect(perRoute, `${route}: expected ${VIEWPORTS.length * REPETITIONS} checks, got ${perRoute}`).toBe(VIEWPORTS.length * REPETITIONS)
  }
})
