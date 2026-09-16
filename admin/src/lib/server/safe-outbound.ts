import "server-only"
import { Agent, buildConnector, fetch as undiciFetch, type Dispatcher } from "undici"
import { isIP } from "node:net"
import { resolve4, resolve6 } from "node:dns/promises"
import { isDisallowedConnectedAddress, isForbiddenAddress } from "./address-safety"

// One shared, reviewed outbound HTTP client for every Forge-controlled crawl.
//
// The security property is that VALIDATION AND THE CONNECTION USE THE SAME
// APPROVED ADDRESS, and the socket is checked again after connect:
//
// 1. For each request and each redirect independently we resolve all A/AAAA
//    records and reject the whole answer set if any address is forbidden.
// 2. TCP is opened to that pinned IP. The original hostname stays on the
//    request URL (Host header) and is set as TLS `servername`, so certificate
//    verification is unchanged and never disabled.
// 3. A custom lookup can only ever return the pinned address, so even if the
//    HTTP stack tries to resolve again it cannot rebind to a private or
//    metadata host.
// 4. After connect, the socket's remoteAddress must match the pin and must
//    not be private, loopback, link-local, or metadata. Mismatch destroys
//    the socket before any request bytes are written.
//
// The client uses undici's own fetch so the Agent and the HTTP stack are the
// same library copy. Failures are fail-closed and never include resolved
// internal addresses.

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

export type SafeOutboundFetch = (
  input: string | URL,
  init?: RequestInit & { dispatcher?: Dispatcher },
) => Promise<Response>

export interface SafeOutboundDependencies {
  /** Resolve a hostname to all of its A and AAAA addresses. */
  resolve: (hostname: string) => Promise<string[]>
  /** The fetch implementation; the pinned dispatcher is supplied per request. */
  fetchImpl: SafeOutboundFetch
  /** Build the address-pinning dispatcher. Overridable for tests. */
  buildDispatcher: (address: string, family: 4 | 6, hostname: string, connectTimeoutMs?: number) => Dispatcher
}

const DEFAULT_ALLOWED_PORTS = { http: ["80"], https: ["443"] }

export function createSafeOutboundClient(dependencies: Partial<SafeOutboundDependencies> = {}) {
  const deps: SafeOutboundDependencies = {
    resolve: dependencies.resolve ?? defaultResolve,
    fetchImpl: dependencies.fetchImpl ?? (undiciFetch as unknown as SafeOutboundFetch),
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
    const { address, family, hostname } = await resolveAndPin(current, deps.resolve)
    const dispatcher = deps.buildDispatcher(address, family, hostname, config.timeoutMs)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)

    let response: Response
    try {
      response = await deps.fetchImpl(current, {
        method: config.method,
        headers: { ...config.headers },
        redirect: "manual",
        signal: controller.signal,
        dispatcher,
      })
    } catch (error) {
      clearTimeout(timer)
      await closeDispatcher(dispatcher)
      if (error instanceof SafeOutboundError) throw error
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

async function resolveAndPin(
  url: URL,
  resolve: (hostname: string) => Promise<string[]>,
): Promise<{ address: string; family: 4 | 6; hostname: string }> {
  const hostname = normalizeHost(url.hostname)
  let addresses: string[]
  if (isIP(hostname)) {
    addresses = [hostname]
  } else {
    try {
      addresses = await resolve(hostname)
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
  return { address, family, hostname }
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

function pinnedLookup(address: string, family: 4 | 6) {
  return (
    _hostname: string,
    options: { all?: boolean },
    callback: (err: NodeJS.ErrnoException | null, address: string | Array<{ address: string; family: number }>, family?: number) => void,
  ) => {
    if (options && options.all) {
      callback(null, [{ address, family }])
    } else {
      callback(null, address, family)
    }
  }
}

export function buildPinnedDispatcher(address: string, family: 4 | 6, hostname: string, connectTimeoutMs = 10_000): Dispatcher {
  const tlsServername = isIP(hostname) ? undefined : hostname
  const connector = buildConnector({
    // Explicit: certificate verification is never disabled.
    rejectUnauthorized: true,
    // Happy Eyeballs must not open a second family that we did not pin.
    autoSelectFamily: false,
    family,
    timeout: connectTimeoutMs,
    lookup: pinnedLookup(address, family),
  })

  return new Agent({
    maxRedirections: 0,
    connections: 1,
    pipelining: 0,
    connect(options, callback) {
      connector(
        {
          ...options,
          hostname: address,
          ...(tlsServername ? { servername: tlsServername } : {}),
        },
        (error, socket) => {
          if (error || !socket) {
            callback(error ?? new Error("connect_failed"), null)
            return
          }
          const remote = "remoteAddress" in socket && typeof socket.remoteAddress === "string" ? socket.remoteAddress : undefined
          if (isDisallowedConnectedAddress(remote, address)) {
            socket.destroy()
            callback(new SafeOutboundError("blocked_address", "The host resolved to a disallowed network address."), null)
            return
          }
          callback(null, socket)
        },
      )
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
