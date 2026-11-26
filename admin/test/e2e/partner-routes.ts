/**
 * Route expectations for the B2.11 partner acceptance.
 *
 * The acceptance used to `continue` on any 404, so a partner page that stopped being served — a routing
 * regression, a switch left off, a deleted page — simply left the run with fewer pages and still passed.
 * Coverage that can shrink silently is not coverage. Every route the suite claims to exercise is now
 * required, with an explicit, documented exception list for anything intentionally absent.
 */

/** The nine partner pages the acceptance claims to cover. */
export const REQUIRED_PARTNER_ROUTES = [
  '/partner/agreement', '/partner/academy', '/partner/resources', '/partner/knowledge', '/partner/objections',
  '/partner/guidance', '/partner/pipeline', '/partner/performance', '/partner/handoffs',
] as const

/** The signed-out pages the acceptance covers. */
export const REQUIRED_PUBLIC_ROUTES = ['/partner/reset', '/partner/withdraw', '/partner/activate'] as const

/**
 * Routes that this stack intentionally does not serve, each with the reason it is absent. Empty today:
 * the CI stack enables every partner switch, so every listed route must answer. An entry here is a
 * deliberate, reviewable decision — not a way to silence a failure.
 */
export const INTENTIONALLY_UNAVAILABLE: Readonly<Record<string, string>> = {}

export type RouteVerdict = { served: boolean; reason: string }

/** Decide whether a response satisfies the route expectation. Pure, so it can be proven without a browser. */
export function routeVerdict(path: string, status: number | undefined): RouteVerdict {
  const exception = INTENTIONALLY_UNAVAILABLE[path]
  if (exception) return { served: false, reason: `intentionally unavailable: ${exception}` }
  if (status === 200) return { served: true, reason: 'served' }
  if (status === undefined) return { served: false, reason: 'no response' }
  return { served: false, reason: `returned ${status}` }
}

/** Throws unless the route is served, or is a documented exception. The message names the route and the status. */
export function assertRouteServed(path: string, status: number | undefined, label: string) {
  const verdict = routeVerdict(path, status)
  if (verdict.served || INTENTIONALLY_UNAVAILABLE[path]) return verdict
  throw new Error(`${label}: required partner route ${path} ${verdict.reason}; a required route must be served`)
}

/** Every required route must have been exercised, so coverage cannot quietly shrink. */
export function assertRouteCoverage(exercised: string[], required: readonly string[], label: string) {
  const missing = required.filter((path) => !exercised.includes(path))
  if (missing.length) throw new Error(`${label}: ${missing.length} required route(s) never exercised: ${missing.join(', ')}`)
}
