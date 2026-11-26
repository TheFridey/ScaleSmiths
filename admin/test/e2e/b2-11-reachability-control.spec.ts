import { expect, test, type Browser } from '@playwright/test'
import { assertReachable } from './partner-reachability'

/**
 * Negative control for the B2.11 reachability assertion.
 *
 * The acceptance is only worth trusting if it still fails when content is genuinely unreachable.
 * This spec manufactures that condition in the browser and requires the measurement to reject it,
 * then removes the injected fault and requires it to pass. It imports the same `assertReachable`
 * the acceptance uses, so the control cannot drift from what it validates.
 *
 * The application is not modified: the unreachable state is injected into the loaded page.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL
const PASSWORD = 'Empower-Demo-Only-2026'
const P1 = 'empower-partner-one@example.invalid'
const origin = () => {
  const a = new URL(base!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103') throw new Error('Refusing to run outside the disposable browser stack.')
  return a.origin
}
async function login(browser: Browser, email: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${origin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(/\/(partner|command-centre|dashboard|expansion)/)
  return { context, page }
}
const rejection = async (promise: Promise<unknown>) => {
  try { await promise; return null } catch (error) { return String((error as Error).message ?? error) }
}

test('the reachability assertion still fails on genuinely unreachable content', async ({ browser }) => {
  origin()
  const { context, page } = await login(browser, P1)
  await page.goto(`${origin()}/partner/resources`)
  await expect(page.locator('h1').first()).toBeVisible()

  // 1. Unreachable content: the scroll region clips its own overflow, so the last content can never
  //    be brought on screen. The document itself is not locked, so only the gap assertion can catch it.
  await page.addStyleTag({ content: '.ac-main{max-height:45vh;overflow:hidden}' })
  const clipped = await rejection(assertReachable(page, 'injected clipped content'))
  expect(clipped, 'the assertion passed on content it could never reach').toContain('content below the reachable viewport')

  // 2. Locked document: the original production defect. The lock assertion must catch it.
  await page.addStyleTag({ content: 'html,body{overflow:hidden!important}' })
  const locked = await rejection(assertReachable(page, 'injected locked document'))
  expect(locked, 'the assertion passed on a locked document').toContain('document scrolling is locked')

  // 3. Undo exactly the faults injected above: the same page must pass, proving the failures were the
  //    injected faults and not a permanently broken assertion. Removal is by handle, so no application
  //    stylesheet can be caught by a pattern match.
  await page.evaluate(() => {
    for (const style of [...document.querySelectorAll('style')]) {
      const css = style.textContent ?? ''
      if (css.includes('.ac-main{max-height:45vh') || css.includes('html,body{overflow:hidden!important}')) style.remove()
    }
  })
  await expect(page.locator('main')).not.toHaveCSS('overflow-y', 'hidden')
  await assertReachable(page, 'restored page after removing the injected faults')

  // 4. Readiness must be a gate, not decoration: a page that never leaves its loading state has to
  //    fail loudly instead of being measured as if it were finished.
  await page.evaluate(() => document.querySelector('main')?.setAttribute('data-content-state', 'loading'))
  const neverReady = await rejection(assertReachable(page, 'stuck in loading state'))
  expect(neverReady, 'a page stuck in its loading state was measured anyway').toContain('never published a ready content state')
  await page.evaluate(() => document.querySelector('main')?.setAttribute('data-content-state', 'ready'))

  await context.close()
})
