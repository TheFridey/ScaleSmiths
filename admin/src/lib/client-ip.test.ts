import { describe, expect, it } from "vitest"
import { UNKNOWN_CLIENT_IP, normalizeIpForRateLimit, resolveClientIp, rightmostForwardedFor } from "./client-ip"

function headers(values: Record<string, string>) {
  return new Headers(values)
}

describe("normalizeIpForRateLimit", () => {
  it("keeps an IPv4 address as its own bucket", () => {
    expect(normalizeIpForRateLimit("203.0.113.7")).toBe("203.0.113.7")
  })

  it("strips an IPv4 port", () => {
    expect(normalizeIpForRateLimit("203.0.113.7:54321")).toBe("203.0.113.7")
  })

  it("buckets an IPv6 address to its /64 prefix", () => {
    expect(normalizeIpForRateLimit("2001:db8:1234:5678:9abc:def0:1234:5678")).toBe("2001:db8:1234:5678::/64")
  })

  it("buckets every address in one /64 identically", () => {
    const first = normalizeIpForRateLimit("2001:db8:1234:5678::1")
    const last = normalizeIpForRateLimit("2001:db8:1234:5678:ffff:ffff:ffff:ffff")
    expect(first).toBe("2001:db8:1234:5678::/64")
    expect(last).toBe(first)
  })

  it("separates different /64 prefixes", () => {
    expect(normalizeIpForRateLimit("2001:db8:1234:5678::1")).not.toBe(normalizeIpForRateLimit("2001:db8:1234:5679::1"))
  })

  it("expands compressed IPv6 correctly", () => {
    expect(normalizeIpForRateLimit("2001:db8::1")).toBe("2001:db8:0:0::/64")
    expect(normalizeIpForRateLimit("::1")).toBe("0:0:0:0::/64")
  })

  it("strips brackets and the port from a bracketed IPv6 address", () => {
    expect(normalizeIpForRateLimit("[2001:db8:1234:5678::1]:443")).toBe("2001:db8:1234:5678::/64")
  })

  it("treats IPv4-mapped IPv6 as the same bucket as plain IPv4", () => {
    expect(normalizeIpForRateLimit("::ffff:203.0.113.7")).toBe("203.0.113.7")
  })

  it("rejects values that are not addresses", () => {
    for (const value of ["", "   ", "not-an-ip", "999.1.1.1", "203.0.113", "2001:db8::1::2", "fe80::1%eth0", "<script>"]) {
      expect(normalizeIpForRateLimit(value)).toBeNull()
    }
  })

  it("rejects null and undefined", () => {
    expect(normalizeIpForRateLimit(null)).toBeNull()
    expect(normalizeIpForRateLimit(undefined)).toBeNull()
  })
})

describe("rightmostForwardedFor", () => {
  it("uses the rightmost entry, which is the one the trusted proxy wrote", () => {
    expect(rightmostForwardedFor("1.2.3.4, 203.0.113.7")).toBe("203.0.113.7")
  })

  it("ignores a spoofed leftmost entry entirely", () => {
    const spoofed = rightmostForwardedFor("198.51.100.1, 198.51.100.2, 203.0.113.7")
    expect(spoofed).toBe("203.0.113.7")
  })

  it("skips unparsable trailing entries rather than failing open", () => {
    expect(rightmostForwardedFor("203.0.113.7, garbage")).toBe("203.0.113.7")
  })

  it("returns null for an empty or entirely invalid chain", () => {
    expect(rightmostForwardedFor("")).toBeNull()
    expect(rightmostForwardedFor(null)).toBeNull()
    expect(rightmostForwardedFor("nonsense, junk")).toBeNull()
  })
})

describe("resolveClientIp", () => {
  it("prefers the rightmost X-Forwarded-For entry", () => {
    expect(resolveClientIp(headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7")
  })

  it("cannot be steered by a client-supplied leftmost entry", () => {
    const attacker = resolveClientIp(headers({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))
    const honest = resolveClientIp(headers({ "x-forwarded-for": "203.0.113.7" }))
    expect(attacker).toBe(honest)
  })

  it("does not trust CF-Connecting-IP unless the topology enables it", () => {
    const supplied = headers({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "203.0.113.7" })
    expect(resolveClientIp(supplied)).toBe("203.0.113.7")
    expect(resolveClientIp(supplied, { trustCloudflareHeader: true })).toBe("9.9.9.9")
  })

  it("falls back to X-Real-IP when no forwarding chain is present", () => {
    expect(resolveClientIp(headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7")
  })

  it("returns a definite bucket when nothing is trustworthy, so limits still apply", () => {
    expect(resolveClientIp(headers({}))).toBe(UNKNOWN_CLIENT_IP)
    expect(resolveClientIp(headers({ "x-forwarded-for": "junk" }))).toBe(UNKNOWN_CLIENT_IP)
  })

  it("buckets an IPv6 client by /64 so prefix rotation cannot evade a limit", () => {
    const first = resolveClientIp(headers({ "x-forwarded-for": "2001:db8:aaaa:bbbb::1" }))
    const second = resolveClientIp(headers({ "x-forwarded-for": "2001:db8:aaaa:bbbb::dead:beef" }))
    expect(first).toBe(second)
  })
})
