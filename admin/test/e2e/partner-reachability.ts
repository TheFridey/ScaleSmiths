import { expect, type Page } from '@playwright/test'

/**
 * Reachability primitives shared by the B2.11 browser acceptance and its negative control.
 *
 * The acceptance originally measured the document immediately after the first heading was visible.
 * On the partner pages that render their content from the API after hydration (Resource Centre,
 * Pipeline), and on the Pipeline at phone widths where it switches from board to list, that measured
 * a skeleton: the document then grew underneath the measurement. Observed on the isolated harness as
 * a 1041-1085px gap with twelve cards arriving mid-measurement, and — worse — as a pass in which no
 * content existed at all yet. Both are the same defect: no readiness condition.
 *
 * This module therefore waits for the application to declare that its content has rendered, for
 * fonts and images to finish, and for the document height to hold still across frames, before it
 * scrolls to the end and asserts. No fixed sleep is used, and the tolerance is unchanged: at the end
 * of the document, nothing may sit more than 1px below the viewport.
 */

/** 1px is the original tolerance. It is deliberately not widened. */
export const REACHABLE_TOLERANCE_PX = 1

/**
 * The application publishes `data-content-state` on `<main>`: `loading` in the server HTML while an
 * asynchronous region is still empty, `ready` once the content it will show has rendered. Pages with
 * no asynchronous region are `ready` when parsed. Absent attribute (a page outside the partner frame)
 * is treated as ready; geometry stability still applies to it.
 */
export async function waitForContentReady(page: Page, label: string) {
  await page.waitForFunction(() => {
    const main = document.querySelector('main')
    if (!main) return true
    return main.getAttribute('data-content-state') !== 'loading'
  }, undefined, { timeout: 15000 }).catch(() => {
    throw new Error(`${label}: the page never left its loading state`)
  })
}

/** Fonts, then images, then a document height that holds still for consecutive frames. */
export async function waitForStableLayout(page: Page, label: string) {
  await page.evaluate(async () => { await document.fonts.ready })
  await page.evaluate(async () => {
    await Promise.all([...document.images].map((image) => (image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    }))))
  })
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const started = performance.now()
    let previous = -1
    let still = 0
    const tick = () => {
      const height = document.documentElement.scrollHeight
      still = height === previous ? still + 1 : 0
      previous = height
      if (still >= 5) return resolve()
      if (performance.now() - started > 15000) return reject(new Error('never settled'))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })).catch(() => { throw new Error(`${label}: the document never stopped changing height`) })
}

/**
 * Scroll to the end until the position converges. Reaching the end can itself reveal content that was
 * below the fold, so convergence — not a count of attempts — is the condition.
 */
export async function scrollToEndAndSettle(page: Page, label: string) {
  const converged = await page.evaluate(async () => {
    const root = document.documentElement
    const previousBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const before = root.scrollHeight
        window.scrollTo(0, root.scrollHeight)
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        if (root.scrollHeight === before && root.scrollTop + root.clientHeight >= root.scrollHeight - 1) return true
      }
      return false
    } finally { root.style.scrollBehavior = previousBehavior }
  })
  if (!converged) throw new Error(`${label}: the document kept growing while scrolling to its end`)
}

/** Distance in pixels between the lowest visible content inside the scroll region and the viewport bottom. */
export async function measureGap(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('main') ?? document.body
    const items = [...root.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden' })
    const bottom = Math.max(...items.map((el) => el.getBoundingClientRect().bottom))
    return bottom - window.innerHeight
  })
}

/** The document is not locked, nothing overflows sideways, and after scrolling to the end the last content is on screen. */
export async function assertReachable(page: Page, label: string) {
  const lock = await page.evaluate(() => [getComputedStyle(document.documentElement).overflowY, getComputedStyle(document.body).overflowY])
  expect(lock, `${label}: document scrolling is locked`).not.toContain('hidden')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${label}: horizontal overflow`).toBeLessThanOrEqual(0)
  await waitForContentReady(page, label)
  // Scrolling to the end can itself load content that then changes the height, so settle, scroll and
  // measure as a unit and repeat while the document is still willing to change. A page whose content
  // genuinely cannot be reached never converges and still fails on the final measurement.
  let gap = Number.NaN
  for (let attempt = 0; attempt < 3; attempt++) {
    await waitForStableLayout(page, label)
    await scrollToEndAndSettle(page, label)
    gap = await measureGap(page)
    if (gap <= REACHABLE_TOLERANCE_PX) break
  }
  expect(gap, `${label}: content below the reachable viewport`).toBeLessThanOrEqual(REACHABLE_TOLERANCE_PX)
}
