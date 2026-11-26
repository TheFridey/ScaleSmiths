import { expect, type Page } from '@playwright/test'

/**
 * Reachability primitives shared by the B2.11 browser acceptance and its negative control.
 *
 * The acceptance originally measured the document immediately after the first heading was visible.
 * On the partner pages that render their content from the API after hydration (Resource Centre,
 * Pipeline), and on the Pipeline at phone widths where it switches from board to list, that measured
 * a skeleton: the document then grew underneath the measurement. Observed on an isolated harness as
 * a 1041-1085px gap with twelve cards arriving mid-measurement, and — worse — as a pass in which no
 * content existed at all yet. Both are the same defect: there was no readiness condition.
 *
 * Order matters and is deliberate: content readiness, then scroll to the end, then images and fonts,
 * then a document height that holds still, then every assertion measured on that settled document.
 * Scrolling can itself start lazy image loads, so images are awaited after the scroll and the lock
 * and overflow checks run after readiness — measuring them on the skeleton would reproduce the very
 * race this module exists to remove. No fixed sleep is used and the tolerance is unchanged.
 */

/** 1px is the original tolerance. It is deliberately not widened. */
export const REACHABLE_TOLERANCE_PX = 1

/**
 * Bounded by design: `next/image` lazy-loads by default, so an image below the fold may never fire
 * load or error before the scroll. An unbounded wait would hang until the test timeout with no
 * readable reason; the settle loop re-checks after the next scroll instead.
 */
const IMAGE_SETTLE_MS = 1000
const STABILITY_SAMPLE_MS = 50
const STABILITY_SAMPLES = 6
/** Bounded everywhere: a gate must fail with a reason, never hang until the test timeout. */
const READINESS_BUDGET_MS = 10000
const STABILITY_BUDGET_MS = 5000
const SETTLE_ATTEMPTS = 2

/**
 * The application publishes `data-content-state` on `<main>`: `loading` in the server HTML while an
 * asynchronous region is still empty, `ready` once the content it will show has rendered. Pages with
 * no asynchronous region are `ready` when parsed. A document with no `<main>` (the signed-out pages)
 * has no asynchronous region either and is treated as ready; its geometry is still gated below.
 */
export async function waitForContentReady(page: Page, label: string, options: { requireSignal: boolean } = { requireSignal: true }) {
  await page.waitForFunction((requireSignal) => {
    const main = document.querySelector('main')
    if (!main) return true // signed-out pages have no partner frame and no asynchronous region
    const state = main.getAttribute('data-content-state')
    if (requireSignal && state === null) return false // a partner page must publish the contract, not skip it
    return state !== 'loading'
  }, options.requireSignal, { timeout: READINESS_BUDGET_MS }).catch(() => {
    throw new Error(`${label}: the page never published a ready content state`)
  })
}

/** Fonts and whatever images have started loading. Never blocks indefinitely. */
export async function waitForFontsAndImages(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready })
  await page.waitForFunction(() => [...document.images].every((image) => image.complete),
    undefined, { timeout: IMAGE_SETTLE_MS }).catch(() => undefined)
}

/**
 * A document height that holds still, sampled rather than animated: six consecutive identical readings 50 ms apart.
 * A requestAnimationFrame loop was tried first and is wrong here — headless Chromium throttles frame delivery for a
 * backgrounded page, so "no frame fired" is indistinguishable from "height never changed" and the wait times out.
 * This measures stability over a 300 ms window and fails loudly instead of measuring a moving page.
 */
export async function waitForStableLayout(page: Page, label: string) {
  await page.evaluate(async ({ sampleMs, samples, budgetMs }) => {
    const started = performance.now()
    let previous = -1
    let still = 0
    while (performance.now() - started < budgetMs) {
      const height = document.documentElement.scrollHeight
      still = height === previous ? still + 1 : 0
      previous = height
      if (still >= samples) return
      await new Promise((r) => setTimeout(r, sampleMs))
    }
    throw new Error('unstable')
  }, { sampleMs: STABILITY_SAMPLE_MS, samples: STABILITY_SAMPLES, budgetMs: STABILITY_BUDGET_MS })
    .catch(() => { throw new Error(`${label}: the document never stopped changing height`) })
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
    const tick = () => new Promise((resolve) => setTimeout(resolve, 32))
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const before = root.scrollHeight
        window.scrollTo(0, root.scrollHeight)
        // Timers, not frames: headless Chromium throttles requestAnimationFrame for a backgrounded tab,
        // and an awaited frame that never arrives is an unbounded wait.
        await tick()
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
    // The whole document, not just <main>: a footer outside the partner frame must be reachable too.
    const root = document.body
    const items = [...root.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden' })
    // An empty region would otherwise yield -Infinity from Math.max and pass silently.
    const bottom = items.length ? Math.max(...items.map((el) => el.getBoundingClientRect().bottom)) : root.getBoundingClientRect().bottom
    return bottom - window.innerHeight
  })
}

export type Reachability = { gap: number; lock: string[]; horizontalOverflow: number }

/** Scroll, settle, and measure the three properties the acceptance asserts. */
async function settleAndMeasure(page: Page, label: string): Promise<Reachability> {
  await scrollToEndAndSettle(page, label)
  await waitForFontsAndImages(page)
  await waitForStableLayout(page, label)
  const lock = await page.evaluate(() => [getComputedStyle(document.documentElement).overflowY, getComputedStyle(document.body).overflowY])
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  return { gap: await measureGap(page), lock, horizontalOverflow }
}

/**
 * The document is not locked, nothing overflows sideways, and after scrolling to the end the last
 * content is on screen. A page whose content genuinely cannot be reached never closes the gap, so
 * retries cannot rescue it; a retry only helps when content arrived between two attempts.
 */
export async function assertReachable(page: Page, label: string, options: { requireSignal?: boolean } = {}) {
  await waitForContentReady(page, label, { requireSignal: options.requireSignal ?? true })
  let result: Reachability | null = null
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt++) {
    result = await settleAndMeasure(page, label)
    if (result.lock.includes('hidden') || result.horizontalOverflow > 0 || result.gap > REACHABLE_TOLERANCE_PX) {
      if (result.lock.includes('hidden')) break // a locked document cannot be scrolled into a better position
      continue
    }
    break
  }
  const measured = result!
  expect(measured.lock, `${label}: document scrolling is locked`).not.toContain('hidden')
  expect(measured.horizontalOverflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0)
  expect(measured.gap, `${label}: content below the reachable viewport`).toBeLessThanOrEqual(REACHABLE_TOLERANCE_PX)
}
