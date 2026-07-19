import "server-only"
import { Agent, type Dispatcher } from "undici"
import { isIP } from "node:net"
import { resolve4, resolve6 } from "node:dns/promises"
import { isForbiddenAddress } from "./address-safety"

// One shared, reviewed outbound HTTP client for every Forge-controlled crawl.
//
// The security property is that VALIDATION AND THE CONNECTION USE THE SAME
// APPROVED ADDRESS. For each request and each redirect independently we resolve
// all A/AAAA records, reject the whole answer set if any address is forbidden,
// then pin one validated address onto an undici dispatcher whose custom `lookup`
// can only ever return that address. DNS cannot rebind the socket to a private
// or metadata host between the check and the fetch. TLS is untouched: undici
// keeps the original hostname as the TLS servername and Host header, so
// certificate verification is unchanged and never disabled.

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])

export type SafeOutboundCode =
  | "invalid_url"
  | "disallowed_scheme"
  | "credentials_in_url"
  | "disallowed_port"
  | "dns_failure"
  | "blocked_address"
  | "redirect_no_location"
  | "redirect_limit"
  | "response_too_large"
  | "timeout"
  | "request_failed"

// A failure whose message is safe to surface: it never contains a resolved
// internal address or resolver output.
export class SafeOutboundError extends Error {
  readonly code: SafeOutboundCode
  constructor(code: SafeOutboundCode, message: string) {
    super(message)
    this.name = "SafeOutboundError"
    this.code = code
  }
}

export interface SafeOutboundOptions {
  method?: string
  headers?: Record<string, string>
  timeoutMs?: number
  maxResponseBytes?: number
  maxRedirects?: number
  /** Per-scheme port allowlist. Defaults to http:80 / https:443 only. */
  allowedPorts?: { http: string[]; https: string[] }
  /**
   * Optional caller policy applied to the initial URL and to every redirect hop,
   * before DNS resolution. Throw to reject the hop (e.g. a domain allowlist).
   * The thrown error propagates unchanged.
   */
  assertHop?: (url: URL) => void
}

export interface SafeOutboundResponse {
  status: number
  headers: Headers
  url: string
  body: string
  redirects: Array<{ from: string; to: string; status: number }>
}

export interface SafeOutboundDependencies {
  /** Resolve a hostname to all of its A and AAAA addresses. */
  resolve: (hostname: string) => Promise<string[]>
  /** The fetch implementation; the pinned dispatcher is supplied per request. */
  fetchImpl: typeof fetch
  /** Build the address-pinning dispatcher. Overridable for tests. */
  buildDispatcher: (address: string, family: 4 | 6) => Dispatcher
}

const DEFAULT_ALLOWED_PORTS = { http: ["80"], https: ["443"] }

export function createSafeOutboundClient(dependencies: Partial<SafeOutboundDependencies> = {}) {
  const deps: SafeOutboundDependencies = {
    resolve: dependencies.resolve ?? defaultResolve,
    fetchImpl: dependencies.fetchImpl ?? fetch,
    buildDispatcher: dependencies.buildDispatcher ?? buildPinnedDispatcher,
  }
  return (rawUrl: string | URL, options: SafeOutboundOptions = {}) => safeFetch(rawUrl, options, deps)
}

async function safeFetch(rawUrl: string | URL, options: SafeOutboundOptions, deps: SafeOutboundDependencies): Promise<SafeOutboundResponse> {
  const config = {
    method: options.method ?? "GET",
    headers: options.headers ?? {},
    timeoutMs: clamp(options.timeoutMs, 1000, 30_000, 10_000),
    maxResponseBytes: clamp(options.maxResponseBytes, 1024, 5_000_000, 1_000_000),
    maxRedirects: clamp(options.maxRedirects, 0, 8, 4),
    allowedPorts: options.allowedPorts ?? DEFAULT_ALLOWED_PORTS,
  }

  let current = parseAndValidate(rawUrl, config.allowedPorts)
  options.assertHop?.(current)
  const redirects: SafeOutboundResponse["redirects"] = []

  for (let hop = 0; ; hop += 1) {
    const { address, family } = await resolveAndPin(current, deps.resolve)
    const dispatcher = deps.buildDispatcher(address, family)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)

    let response: Response
    try {
      response = await deps.fetchImpl(current, {
        method: config.method,
        headers: { ...config.headers },
        redirect: "manual",
        signal: controller.signal,
        // @ts-expect-error Node's fetch accepts an undici dispatcher at runtime.
        dispatcher,
      })
    } catch {
      clearTimeout(timer)
      await closeDispatcher(dispatcher)
      if (controller.signal.aborted) throw new SafeOutboundError("timeout", "The request timed out.")
      // Deliberately generic: never surface connect errors that could reveal
      // internal network reachability.
      throw new SafeOutboundError("request_failed", "The request could not be completed.")
    }

    if (REDIRECT_STATUS.has(response.status)) {
      clearTimeout(timer)
      await closeDispatcher(dispatcher)
      if (hop >= config.maxRedirects) throw new SafeOutboundError("redirect_limit", "Too many redirects.")
      const location = response.headers.get("location")
      if (!location) throw new SafeOutboundError("redirect_no_location", "A redirect did not provide a destination.")
      let next: URL
      try {
        next = new URL(location, current)
      } catch {
        throw new SafeOutboundError("invalid_url", "A redirect destination was not a valid URL.")
      }
      // Each redirect is independently re-validated (and re-resolved/re-pinned at
      // the top of the next iteration).
      current = parseAndValidate(next, config.allowedPorts)
      options.assertHop?.(current)
      redirects.push({ from: response.url || location, to: current.toString(), status: response.status })
      continue
    }

    try {
      const declared = Number(response.headers.get("content-length") ?? "")
      if (Number.isFinite(declared) && declared > config.maxResponseBytes) {
        controller.abort()
        throw new SafeOutboundError("response_too_large", "The response exceeded the size limit.")
      }
      const body = await readBoundedText(response, config.maxResponseBytes, controller)
      return { status: response.status, headers: response.headers, url: current.toString(), body, redirects }
    } finally {
      clearTimeout(timer)
      await closeDispatcher(dispatcher)
    }
  }
}

function parseAndValidate(rawUrl: string | URL, allowedPorts: { http: string[]; https: string[] }): URL {
  let url: URL
  try {
    url = typeof rawUrl === "string" ? new URL(rawUrl) : new URL(rawUrl.toString())
  } catch {
    throw new SafeOutboundError("invalid_url", "The URL was not valid.")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SafeOutboundError("disallowed_scheme", "Only http and https URLs are allowed.")
  if (url.username || url.password) throw new SafeOutboundError("credentials_in_url", "URLs must not contain credentials.")
  const scheme = url.protocol === "http:" ? "http" : "https"
  const port = url.port === "" ? (scheme === "http" ? "80" : "443") : url.port
  if (!allowedPorts[scheme].includes(port)) throw new SafeOutboundError("disallowed_port", "That port is not allowed.")
  return url
}

async function resolveAndPin(url: URL, resolve: (hostname: string) => Promise<string[]>): Promise<{ address: string; family: 4 | 6 }> {
  const host = normalizeHost(url.hostname)
  let addresses: string[]
  if (isIP(host)) {
    addresses = [host]
  } else {
    try {
      addresses = await resolve(host)
    } catch {
      throw new SafeOutboundError("dns_failure", "The host could not be resolved.")
    }
  }
  if (!addresses.length) throw new SafeOutboundError("dns_failure", "The host did not resolve to any address.")
  // Reject the entire answer set if ANY address is forbidden (a mixed safe/unsafe
  // response is treated as hostile).
  for (const candidate of addresses) {
    if (isForbiddenAddress(candidate)) throw new SafeOutboundError("blocked_address", "The host resolved to a disallowed network address.")
  }
  const address = addresses[0]
  const family = isIP(address) === 6 ? 6 : 4
  return { address, family }
}

// Strip brackets from IPv6 literals and a single trailing dot from names.
function normalizeHost(hostname: string): string {
  const withoutBrackets = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname
  return withoutBrackets.replace(/\.$/, "")
}

async function defaultResolve(hostname: string): Promise<string[]> {
  const [v4, v6] = await Promise.allSettled([resolve4(hostname), resolve6(hostname)])
  const addresses: string[] = []
  if (v4.status === "fulfilled") addresses.push(...v4.value)
  if (v6.status === "fulfilled") addresses.push(...v6.value)
  return addresses
}

export function buildPinnedDispatcher(address: string, family: 4 | 6): Dispatcher {
  return new Agent({
    maxRedirections: 0,
    connect: {
      // The pinned address is the only place this connection can ever go. undici
      // still uses the original hostname for TLS servername + Host, so
      // certificate verification stays intact. rejectUnauthorized is left at its
      // secure default — never disabled.
      lookup(
        _hostname: string,
        options: { all?: boolean },
        callback: (err: NodeJS.ErrnoException | null, address: string | Array<{ address: string; family: number }>, family?: number) => void,
      ) {
        if (options && options.all) {
          callback(null, [{ address, family }])
        } else {
          callback(null, address, family)
        }
      },
    },
  })
}

async function closeDispatcher(dispatcher: Dispatcher) {
  try {
    await dispatcher.close()
  } catch {
    // Best-effort cleanup; a failed close must not mask the real result.
  }
}

async function readBoundedText(response: Response, maxBytes: number, controller: AbortController): Promise<string> {
  if (!response.body) {
    const text = await response.text()
    if (Buffer.byteLength(text) > maxBytes) throw new SafeOutboundError("response_too_large", "The response exceeded the size limit.")
    return text
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        controller.abort()
        throw new SafeOutboundError("response_too_large", "The response exceeded the size limit.")
      }
      chunks.push(value)
    }
  }
  return new TextDecoder().decode(concat(chunks, total))
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? Number(value) : fallback))
}
