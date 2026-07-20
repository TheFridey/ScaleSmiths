import { describe, expect, it } from "vitest"
import { classifyAddress, isForbiddenAddress } from "./address-safety"

describe("address-safety classifier", () => {
  const forbidden = [
    // IPv4 — internal / special-purpose
    "0.0.0.0",
    "10.0.0.1",
    "10.255.255.255",
    "127.0.0.1",
    "127.1.2.3",
    "100.64.0.1",
    "100.127.255.255",
    "169.254.0.1",
    "169.254.169.254", // cloud metadata
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.1",
    "192.168.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.19.255.255",
    "224.0.0.1", // multicast
    "239.255.255.250",
    "240.0.0.1", // reserved
    "255.255.255.255", // broadcast
    // IPv6 — internal / special-purpose
    "::",
    "::1",
    "fc00::1",
    "fd12:3456:789a:1::1",
    "fe80::1",
    "febf::1",
    "ff02::1", // multicast
    // IPv4-mapped / embedded forms must classify by the embedded IPv4
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:10.0.0.1",
    "::ffff:7f00:1", // hex-form mapped loopback
    "64:ff9b::7f00:1", // NAT64 loopback
    "64:ff9b::a9fe:a9fe", // NAT64 metadata
    "::7f00:1", // deprecated IPv4-compatible loopback
  ]

  const safe = [
    "8.8.8.8",
    "1.1.1.1",
    "203.0.113.10", // documentation range — used as a public stand-in in tests
    "198.51.100.7",
    "192.0.2.1",
    "2606:4700:4700::1111", // Cloudflare public v6
    "2001:db8::1", // documentation v6 — treated as safe stand-in
    "::ffff:8.8.8.8", // mapped public address
  ]

  for (const address of forbidden) {
    it(`forbids ${address}`, () => {
      expect(isForbiddenAddress(address)).toBe(true)
      expect(classifyAddress(address).safe).toBe(false)
    })
  }

  for (const address of safe) {
    it(`allows ${address}`, () => {
      expect(isForbiddenAddress(address)).toBe(false)
      expect(classifyAddress(address).safe).toBe(true)
    })
  }

  it("rejects non-IP input outright", () => {
    for (const value of ["example.com", "", "not-an-ip", "999.1.1.1", "12345"]) {
      expect(isForbiddenAddress(value)).toBe(true)
    }
  })

  it("reports a stable reason code without leaking the address", () => {
    const result = classifyAddress("169.254.169.254")
    expect(result.safe).toBe(false)
    if (!result.safe) {
      expect(result.reason).toBe("link_local")
      expect(result.reason).not.toContain("169")
    }
  })
})
