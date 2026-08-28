// Trusted client-IP resolution for rate limiting.
//
// Topology (docs/operations/cloudflare-access.md):
//   * scalesmiths.co.uk is a DIRECT origin. Nginx is the only hop, so
//     $remote_addr is the true TCP peer, and the shared proxy snippets overwrite
//     X-Forwarded-For with it rather than appending to a client-supplied chain.
//   * admin.scalesmiths.co.uk sits behind Cloudflare. Nginx validates the TCP
//     peer against generated Cloudflare ranges, rewrites $remote_addr with
//     real_ip, then overwrites every forwarding header from it.
//
// In both topologies the RIGHTMOST X-Forwarded-For entry is the value written by
// the trusted hop; anything to its left is attacker supplied. Reading the
// LEFTMOST entry — the usual mistake — lets any client pick its own rate-limit
// bucket simply by sending its own X-Forwarded-For header.
//
// Addresses are then reduced to a bucket: IPv4 to the exact address, IPv6 to its
// /64 prefix. A single IPv6 customer is routinely delegated a /64 (often a /56 or
// /48), so limiting on a full 128-bit address lets one attacker walk through
// billions of distinct keys and defeat every per-IP limit.

export const UNKNOWN_CLIENT_IP = "unknown"

/** Number of leading IPv6 hextets that identify the /64 bucket. */
const IPV6_BUCKET_GROUPS = 4

export interface ResolveClientIpOptions {
  /**
   * Trust CF-Connecting-IP. Only enable where Nginx has already verified the TCP
   * peer is Cloudflare; otherwise the header is client supplied.
   */
  trustCloudflareHeader?: boolean
}

/**
 * Resolves the rate-limiting bucket for a request. Returns `UNKNOWN_CLIENT_IP`
 * when no trustworthy address is present, so callers still apply a limit rather
 * than failing open.
 */
export function resolveClientIp(headers: Headers, options: ResolveClientIpOptions = {}): string {
  if (options.trustCloudflareHeader) {
    const cloudflare = normalizeIpForRateLimit(headers.get("cf-connecting-ip"))
    if (cloudflare) return cloudflare
  }

  const forwarded = rightmostForwardedFor(headers.get("x-forwarded-for"))
  if (forwarded) return forwarded

  const realIp = normalizeIpForRateLimit(headers.get("x-real-ip"))
  if (realIp) return realIp

  return UNKNOWN_CLIENT_IP
}

/**
 * Returns the rightmost syntactically valid entry of an X-Forwarded-For chain,
 * normalized to its rate-limit bucket. The rightmost entry is the only one a
 * trusted proxy is guaranteed to have written.
 */
export function rightmostForwardedFor(header: string | null | undefined): string | null {
  if (!header) return null

  const entries = header.split(",")
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const candidate = normalizeIpForRateLimit(entries[index])
    if (candidate) return candidate
  }

  return null
}

/**
 * Normalizes one address to a stable rate-limit bucket, or null when the value
 * is not a usable address. IPv4 maps to itself; IPv6 maps to `<prefix>::/64`.
 */
export function normalizeIpForRateLimit(raw: string | null | undefined): string | null {
  const value = stripPortAndBrackets(raw)
  if (!value) return null

  if (isIpv4(value)) return value

  const groups = expandIpv6(value)
  if (!groups) return null

  // ::ffff:203.0.113.7 and friends are IPv4 traffic; bucket them as IPv4 so the
  // same client cannot occupy two buckets depending on socket family.
  const mapped = mappedIpv4(groups)
  if (mapped) return mapped

  return `${groups.slice(0, IPV6_BUCKET_GROUPS).join(":")}::/64`
}

function stripPortAndBrackets(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null

  // [2001:db8::1]:443 — bracketed form always carries an optional port.
  const bracketed = value.match(/^\[([^\]]+)\](?::\d{1,5})?$/)
  if (bracketed) return bracketed[1].trim() || null

  // A single colon means IPv4:port; multiple colons mean a bare IPv6 address.
  const colons = value.split(":").length - 1
  if (colons === 1) return value.slice(0, value.indexOf(":")).trim() || null

  return value
}

function isIpv4(value: string): boolean {
  const parts = value.split(".")
  if (parts.length !== 4) return false

  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Expands an IPv6 address to exactly eight lowercase hextets, or null. */
function expandIpv6(value: string): string[] | null {
  let address = value.toLowerCase()
  // Reject a zone index (fe80::1%eth0); link-local traffic is never a real peer.
  if (address.includes("%")) return null
  if (address.split("::").length - 1 > 1) return null

  // Fold a trailing dotted quad (::ffff:203.0.113.7) into two hextets first, so
  // the rest of the parser only ever deals with colon-separated groups.
  const dotted = address.match(/^(.*:)((?:\d{1,3}\.){3}\d{1,3})$/)
  if (dotted) {
    if (!isIpv4(dotted[2])) return null
    const octets = dotted[2].split(".").map(Number)
    address = `${dotted[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`
  }

  const compressed = address.includes("::")
  const [left, right = ""] = compressed ? address.split("::") : [address]
  const leftGroups = left ? left.split(":").filter(Boolean) : []
  const rightGroups = right ? right.split(":").filter(Boolean) : []
  const explicit = [...leftGroups, ...rightGroups]

  if (!explicit.length && !compressed) return null
  if (explicit.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null

  if (!compressed) return explicit.length === 8 ? explicit.map(padGroup) : null
  if (explicit.length >= 8) return null

  const fill: string[] = new Array(8 - explicit.length).fill("0")
  return [...leftGroups, ...fill, ...rightGroups].map(padGroup)
}

function padGroup(group: string): string {
  return group.replace(/^0+(?=.)/, "")
}

function mappedIpv4(groups: string[]): string | null {
  const isMapped = groups.slice(0, 5).every((group) => group === "0") && groups[5] === "ffff"
  if (!isMapped) return null

  const high = Number.parseInt(groups[6], 16)
  const low = Number.parseInt(groups[7], 16)
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
}
