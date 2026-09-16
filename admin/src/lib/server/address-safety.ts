import "server-only"
import { isIP } from "node:net"

// Pure, network-free classification of an IP address as safe (a genuinely
// external destination) or forbidden (something a Forge-controlled crawl must
// never reach: our own host, private networks, link-local/cloud metadata,
// multicast, or otherwise special-purpose ranges).
//
// Callers pass addresses that have already been through the WHATWG URL parser
// (which normalises IPv4 decimal/octal/hex shorthands to dotted-decimal and
// canonicalises IPv6 literals) or that came straight from DNS resolution, so the
// input here is always a canonical IPv4 or IPv6 string. Documentation ranges
// (RFC 5737 / RFC 3849) are intentionally treated as safe: they are not internal
// and are widely used as public stand-ins in deterministic tests.

export type AddressClassification = { safe: true } | { safe: false; reason: string }

export function classifyAddress(address: string): AddressClassification {
  const version = isIP(address)
  if (version === 4) return classifyIpv4(parseIpv4(address)!)
  if (version === 6) return classifyIpv6(address)
  // Not a canonical IP literal: the caller must not connect to it directly.
  return { safe: false, reason: "not_an_ip" }
}

export function isForbiddenAddress(address: string): boolean {
  return !classifyAddress(stripIpv6Zone(address)).safe
}

// Canonical form used to compare a pinned destination with a connected socket
// address. IPv4-mapped IPv6 collapses to dotted-decimal IPv4 so ::ffff:a.b.c.d
// cannot be treated as a different host from a.b.c.d. Returns null when the
// input is not an IP.
export function normalizeIpAddress(address: string): string | null {
  const trimmed = stripIpv6Zone(address)
  const version = isIP(trimmed)
  if (version === 4) return trimmed
  if (version === 6) {
    const hextets = expandIpv6(trimmed)
    if (!hextets) return null
    if (isZero(hextets, 0, 4) && hextets[5] === 0xffff) return embeddedIpv4(hextets).join(".")
    return hextets.map((hextet) => hextet.toString(16).padStart(4, "0")).join(":")
  }
  return null
}

export function addressesReferToSameHost(left: string, right: string): boolean {
  const a = normalizeIpAddress(left)
  const b = normalizeIpAddress(right)
  return a !== null && a === b
}

// Fail-closed check for the address a socket actually connected to. Missing
// remotes, private/loopback/link-local/metadata remotes, and remotes that do
// not match the pinned destination are all disallowed.
export function isDisallowedConnectedAddress(remote: string | undefined, pinned: string): boolean {
  if (!remote) return true
  if (isForbiddenAddress(remote) || isForbiddenAddress(pinned)) return true
  return !addressesReferToSameHost(remote, pinned)
}

function stripIpv6Zone(address: string): string {
  const withoutBrackets = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address
  const zone = withoutBrackets.indexOf("%")
  return zone === -1 ? withoutBrackets : withoutBrackets.slice(0, zone)
}

function classifyIpv4(octets: number[]): AddressClassification {
  const [a, b, c] = octets
  if (a === 0) return forbidden("unspecified") // 0.0.0.0/8
  if (a === 10) return forbidden("private") // 10.0.0.0/8
  if (a === 127) return forbidden("loopback") // 127.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return forbidden("cgnat") // 100.64.0.0/10
  if (a === 169 && b === 254) return forbidden("link_local") // 169.254.0.0/16 (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return forbidden("private") // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return forbidden("special_purpose") // 192.0.0.0/24
  if (a === 192 && b === 168) return forbidden("private") // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return forbidden("benchmarking") // 198.18.0.0/15
  if (a >= 224) return forbidden("multicast_or_reserved") // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved, 255.255.255.255 broadcast
  return { safe: true }
}

function classifyIpv6(address: string): AddressClassification {
  const hextets = expandIpv6(address)
  if (!hextets) return forbidden("malformed_ipv6")

  // IPv4-mapped ::ffff:0:0/96 — classify the embedded IPv4 so a mapped private
  // or loopback address cannot slip through.
  if (isZero(hextets, 0, 4) && hextets[5] === 0xffff) return classifyIpv4(embeddedIpv4(hextets))
  // NAT64 well-known prefix 64:ff9b::/96 — also carries an embedded IPv4.
  if (hextets[0] === 0x0064 && hextets[1] === 0xff9b && isZero(hextets, 2, 4)) return classifyIpv4(embeddedIpv4(hextets))
  // Deprecated IPv4-compatible ::/96 (e.g. ::7f00:1) — treat the tail as IPv4.
  if (isZero(hextets, 0, 5) && !(hextets[6] === 0 && hextets[7] === 0)) {
    if (hextets[6] === 0 && hextets[7] === 1) return forbidden("loopback") // ::1
    return classifyIpv4(embeddedIpv4(hextets))
  }
  if (isZero(hextets, 0, 7) && hextets[7] === 0) return forbidden("unspecified") // ::

  if ((hextets[0] & 0xff00) === 0xff00) return forbidden("multicast") // ff00::/8
  if ((hextets[0] & 0xffc0) === 0xfe80) return forbidden("link_local") // fe80::/10
  if ((hextets[0] & 0xfe00) === 0xfc00) return forbidden("unique_local") // fc00::/7
  return { safe: true }
}

// Accepts only canonical dotted-decimal IPv4 (each octet 0-255). Returns null
// otherwise; the caller has already validated with isIP.
function parseIpv4(address: string): number[] | null {
  const parts = address.split(".")
  if (parts.length !== 4) return null
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null
  return octets
}

// Expands an IPv6 string (already validated by isIP) to eight 16-bit hextets,
// resolving :: compression and any trailing dotted-decimal IPv4 tail.
function expandIpv6(address: string): number[] | null {
  let text = address
  // Fold a trailing dotted-decimal IPv4 (e.g. ::ffff:127.0.0.1) into two hextets.
  if (text.includes(".")) {
    const lastColon = text.lastIndexOf(":")
    if (lastColon === -1) return null
    const octets = parseIpv4(text.slice(lastColon + 1))
    if (!octets) return null
    const high = ((octets[0] << 8) | octets[1]).toString(16)
    const low = ((octets[2] << 8) | octets[3]).toString(16)
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`
  }

  const halves = text.split("::")
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(":") : []

  let groups: string[]
  if (halves.length === 1) {
    if (head.length !== 8) return null
    groups = head
  } else {
    const back = halves[1] ? halves[1].split(":") : []
    const missing = 8 - head.length - back.length
    if (missing < 1) return null // "::" must stand for at least one zero group
    groups = [...head, ...new Array(missing).fill("0"), ...back]
  }

  const hextets = groups.map((group) => (/^[0-9a-fA-F]{1,4}$/.test(group) ? Number.parseInt(group, 16) : Number.NaN))
  if (hextets.length !== 8 || hextets.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff)) return null
  return hextets
}

function embeddedIpv4(hextets: number[]): number[] {
  return [hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff]
}

function isZero(hextets: number[], from: number, to: number): boolean {
  for (let index = from; index < to; index += 1) if (hextets[index] !== 0) return false
  return true
}

function forbidden(reason: string): AddressClassification {
  return { safe: false, reason }
}
