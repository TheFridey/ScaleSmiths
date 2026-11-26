/**
 * Route expectations for the B2.11 partner acceptance.
 *
 * The acceptance used to `continue` on any 404, so a partner page that stopped being served — a routing
 * regression, a switch left off, a deleted page — simply left the run with fewer pages and still passed.
 * Coverage that can shrink silently is not coverage.
 *
 * Two things make the guard trustworthy, and both were added after review:
 *  - the final URL is checked, not only the status, because `page.goto` follows redirects: a partner page
 *    that bounces to /login reports the login page's 200;
 *  - an exception tolerates only the statuses it names (404 by default), never a 500 and never a 200, so an
 *    entry cannot quietly hide a broken page.
 */

/** The nine partner pages the acceptance claims to cover. */
export const REQUIRED_PARTNER_ROUTES = [
  '/partner/agreement', '/partner/academy', '/partner/resources', '/partner/knowledge', '/partner/objections',
  '/partner/guidance', '/partner/pipeline', '/partner/performance', '/partner/handoffs',
] as const

/** The signed-out pages the acceptance covers. */
export const REQUIRED_PUBLIC_ROUTES = ['/partner/reset', '/partner/withdraw', '/partner/activate'] as const

/**
 * Routes this stack intentionally does not serve. Empty today: the CI stack enables every partner switch,
 * so every listed route must answer. An entry names the exact statuses it excuses and the reason, so it
 * cannot hide a 500 or a page that has come back.
 */
export type RouteException = { reason: string; statuses: readonly number[] }
export const INTENTIONALLY_UNAVAILABLE: Readonly<Record<string, RouteException>> = {}

export type RouteVerdict = { served: boolean; tolerated: boolean; reason: string }

const sameDocument = (requested: string, finalPath: string) =>
  requested.replace(/\/+$/, '') === finalPath.replace(/\/+$/, '')

/**
 * Decide whether a navigation satisfies its route expectation. Pure, so the decision can be proven
 * without a browser. `status` is the final response status; `finalPath` is where the browser ended up.
 */
export function routeVerdict(
  path: string,
  status: number | undefined,
  finalPath: string = path,
  exceptions: Readonly<Record<string, RouteException>> = INTENTIONALLY_UNAVAILABLE,
): RouteVerdict {
  if (!sameDocument(path, finalPath)) {
    return { served: false, tolerated: false, reason: `ended at ${finalPath} instead of ${path}` }
  }
  const exception = exceptions[path]
  if (status === undefined) return { served: false, tolerated: false, reason: 'no response' }
  if (exception && exception.statuses.includes(status)) {
    return { served: false, tolerated: true, reason: `intentionally unavailable (${status}): ${exception.reason}` }
  }
  // 304 is a revalidated document the browser already has; anything else must be a fresh 200.
  if (status === 200 || status === 304) return { served: true, tolerated: false, reason: 'served' }
  return { served: false, tolerated: false, reason: `returned ${status}` }
}

/** Throws unless the route is served, or is a documented exception for exactly that status. */
export function assertRouteServed(
  path: string,
  status: number | undefined,
  label: string,
  finalPath: string = path,
  exceptions: Readonly<Record<string, RouteException>> = INTENTIONALLY_UNAVAILABLE,
): RouteVerdict {
  const verdict = routeVerdict(path, status, finalPath, exceptions)
  if (verdict.served || verdict.tolerated) return verdict
  throw new Error(`${label}: required partner route ${path} ${verdict.reason}; a required route must be served`)
}

/**
 * Every required route must have been exercised at every viewport. Keys are `${path}@${width}x${height}`,
 * so a viewport that silently stopped being visited fails too — presence in a list is not enough.
 */
export function assertRouteCoverage(exercised: readonly string[], required: readonly string[], label: string) {
  const seen = new Set(exercised)
  const missing = required.filter((key) => !seen.has(key))
  if (missing.length) throw new Error(`${label}: ${missing.length} required route/viewport combination(s) never exercised: ${missing.join(', ')}`)
}

/** Build the coverage key the spec records for one successful visit. */
export const coverageKey = (path: string, viewport: { width: number; height: number }) => `${path}@${viewport.width}x${viewport.height}`
