import { expect, test, type Browser, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { generateTotp } from '../../src/lib/server/mfa'

/**
 * Operation EMPOWER B2.11 browser acceptance: every partner page scrolls as a normal document and its last content is reachable;
 * the founder app shell keeps its fixed frame with its own scroll region. Production admin build, disposable
 * ss_empower_browser_e2e database seeded by scripts/seed-empower-browser.mjs. Synthetic identities only; read-only navigation.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL
const PASSWORD = 'Empower-Demo-Only-2026'
const FOUNDER_A = { email: 'empower-founder-a@example.invalid', secret: 'JBSWY3DPEHPK3PXP' }
const P1 = 'empower-partner-one@example.invalid'
const evidence = '../docs/expansion/empower/evidence/b2-11/browser'
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]
const PARTNER_PAGES = ['/partner/agreement', '/partner/academy', '/partner/resources', '/partner/knowledge', '/partner/objections',
  '/partner/guidance', '/partner/pipeline', '/partner/performance', '/partner/handoffs']
const PUBLIC_PAGES = ['/partner/reset', '/partner/withdraw', '/partner/activate']
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
  await page.waitForURL(/\/(partner|command-centre|dashboard|expansion)/)
  return { context, page }
}
const slug = (path: string) => path.replace(/^\//, '').replaceAll('/', '-')

/** The document is not locked, nothing overflows sideways, and after scrolling to the end the last piece of content is on screen. */
async function assertReachable(page: Page, label: string) {
  const lock = await page.evaluate(() => [getComputedStyle(document.documentElement).overflowY, getComputedStyle(document.body).overflowY])
  expect(lock, `${label}: document scrolling is locked`).not.toContain('hidden')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${label}: horizontal overflow`).toBeLessThanOrEqual(0)
  // Client-rendered sections (course lists, search results) can still be arriving after the heading is visible, so the page may
  // grow between scrolling and measuring. Wait for the network, then scroll and measure in one step until it settles. A page that
  // genuinely cannot scroll to its end never reaches <= 1px and still fails.
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.keyboard.press('End')
  await expect.poll(() => page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
    const root = document.querySelector('main') ?? document.body
    const items = [...root.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden' })
    const bottom = Math.max(...items.map((el) => el.getBoundingClientRect().bottom))
    return bottom - window.innerHeight
  }), { message: `${label}: content below the reachable viewport`, timeout: 10_000 }).toBeLessThanOrEqual(1)
}

test('partner pages scroll to their last content at desktop, tablet and mobile sizes', async ({ browser }) => {
  await mkdir(evidence, { recursive: true })
  const { context, page } = await login(browser, P1)
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    for (const path of PARTNER_PAGES) {
      const response = await page.goto(`${origin()}${path}`)
      if (response?.status() === 404) continue // a module switched off in this stack has no page to scroll
      await expect(page.locator('h1').first()).toBeVisible()
      await assertReachable(page, `${path} @ ${viewport.width}x${viewport.height}`)
      if (viewport.width === 1440 || viewport.width === 390) await page.screenshot({ path: `${evidence}/${slug(path)}-${viewport.width}.png`, fullPage: true })
    }
  }
  await context.close()
})

test('signed-out recovery, withdrawal and activation pages scroll', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
    await page.setViewportSize(viewport)
    for (const path of PUBLIC_PAGES) {
      await page.goto(`${origin()}${path}`)
      await assertReachable(page, `${path} @ ${viewport.width}x${viewport.height}`)
    }
  }
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
