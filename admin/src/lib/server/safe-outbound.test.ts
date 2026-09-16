import { afterEach, describe, expect, it, vi } from "vitest"
import http from "node:http"
import https from "node:https"
import dns from "node:dns"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { isIP, type AddressInfo } from "node:net"
import { createSafeOutboundClient, buildPinnedDispatcher, SafeOutboundError, type SafeOutboundCode } from "./safe-outbound"

const execFileAsync = promisify(execFile)

// A self-signed cert (CN=localhost) used only to prove TLS verification stays on.
const SELF_SIGNED_CERT = `-----BEGIN CERTIFICATE-----
MIIDJTCCAg2gAwIBAgIUazFfJgnLEBAJyZfRhmOVbPrtuawwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDcxOTIwMzQ0MFoXDTM2MDcx
NjIwMzQ0MFowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEA1X+VUpSBptzRdPi+iRJASXywwkMGk9xwTaZ6YZ3M7i2Y
dUZolCMn473fNPLDqv0xKKc1u+lSXpf3bWefp8K/LUHjb8v1E7mQGLvl5M9rO2xS
vnUtqhNDnpizBzkTHeXF7+kxrV5vUa+Y+KwC3v6b1ZsyA9iLS6dx64faPq/yYfqT
dJyh+aZDkak3beJcYxyfRi8YU3i/UEMeqzSISHSMhO6kAgp9bVVEmeEzrpkVxna0
DO/pWcV3YWNCOFSdzsKichwiWRaMaSxWT6dVCnj0nlbQRfGuMLIgAnPTn4IXIrCF
Njmrsh0zPZkmhkdSodw5pkFq08xm1ck+MmvMTqClzQIDAQABo28wbTAdBgNVHQ4E
FgQUxwEMmtl7jSzdYYS2HD7BNJ3pAqIwHwYDVR0jBBgwFoAUxwEMmtl7jSzdYYS2
HD7BNJ3pAqIwDwYDVR0TAQH/BAUwAwEB/zAaBgNVHREEEzARgglsb2NhbGhvc3SH
BH8AAAEwDQYJKoZIhvcNAQELBQADggEBAEqziV6Ub2Mjrkv7sOt+4/58I7efMaiy
3liZBPjHXeXfRAprThxUaHx3OyqeORoAmUj/Lqf9LJSEdf0yWW9TUCjcStChBBhf
l/T1rXNGgrDwt+A4XWsZKVA1kcm1WyqsYSGos/gKZedHg0D5nXKsoMWJgjSFeTf4
5OIVDNFV83z497TlnfJEoihQEDvY8QxCuDisLupzD3U6NVDf1ZISLTgGrqHdB03i
01xFSfkLuH8mehwe/Lw4et71/eTS0e/cj/iXvtDU82ImjVpFZVTzBrhpKn/iu5Y3
3d6AANZ8VM4/m7dORAFMvQb6K7YXKrwYRv0h75C2FNouBuixFgU66Mo=
-----END CERTIFICATE-----`

const SELF_SIGNED_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDVf5VSlIGm3NF0
+L6JEkBJfLDCQwaT3HBNpnphnczuLZh1RmiUIyfjvd808sOq/TEopzW76VJel/dt
Z5+nwr8tQeNvy/UTuZAYu+Xkz2s7bFK+dS2qE0OemLMHORMd5cXv6TGtXm9Rr5j4
rALe/pvVmzID2ItLp3Hrh9o+r/Jh+pN0nKH5pkORqTdt4lxjHJ9GLxhTeL9QQx6r
NIhIdIyE7qQCCn1tVUSZ4TOumRXGdrQM7+lZxXdhY0I4VJ3OwqJyHCJZFoxpLFZP
p1UKePSeVtBF8a4wsiACc9OfghcisIU2OauyHTM9mSaGR1Kh3DmmQWrTzGbVyT4y
a8xOoKXNAgMBAAECggEAIU+2Szu7nP7wOXmENRvhZvXrGGxfzttCtILormlyK6l2
k7nIIHD5zNl3xampKPk3Xdn1Etw9S2AXrXzRFtpWfOe+Zlei5hB6cLmEjbZlS1DD
+k6LMPGvh8PYjyRzHKOYxi2S4DOPV+X3jrk7+3Ire2ErJRl45nV6W18HiOdoAKxQ
tkzgxhuhPvY/Opdk3/yv3B+SBPJmst5Vp5I0+wNYRKyAObD7XmJXTDhqgSAfEKV8
uoZDZz4nyuK8EKo29beDkvav/f07GFDXJ+LtRrPHRP2dXZ3l1+0BqW+YvfrGrDPN
9wGIssqNddfEZPaXkqZzPmje/mbmy34qxBF4bhHFkQKBgQDtJw0ortSociruSOFB
0zY2SNepE1bV2SxpC5WFu5Tt+jxv+xxKrwIqo5u5Ps8AKXMAhmMXgxJEpbWLIi8q
qMxzlhlAdt0HXlwEbuUdJ33sdeN0nNg4x7D5SW+3xtuJ16JRxdZQUJZD+rBwqsxx
TykvS3fNke88BKIKsmlicAy29QKBgQDmd0eexUtraml9L02mhpkKuS8siwpgAFUM
EsM8Jr7qfIG8tAugOhHRIeC3rB8mbjJlQIBHWtxUnhk3+LXJ32/8WdhsYBjr4v8Z
atbxjw92JP+l1bS99G5A6UcmNYTmhSNm2qN66uC3zEXZTUECg5SczZJ9F6gjIj5w
qxO2jVH8eQKBgFroF1E7A2W2reI9qatz7VoNvi2fri+3WiDCQgTLjSFURQqf9Y5j
W69AnBb8jpj/Sogu+5ktszkBVIALEI2Huyerp+5gIgYLE7bXU5hDZS/ZWOGAphnN
4ncMwXhvEATc1eoGrkqHObLBTBVEQ65DrAPnJ/tzL4OQOxVioqcLULRpAoGAL0th
FjL0tDllJnxzme3bMDkqdiCeY28OBOlAyXJGEYa1dQ0ZqarhByLFo8udpNxOWTrw
WDRMLM047aSLYb8Jkya45BygYJ/3q7aiH3Y1PRCAqf5+FdE4Yve8Uxn+iPPffPb3
P3092loAJ4TUB3kLIVaKbkNRjMw1NhfVdsvvfDkCgYAvpVkCVx2EuTBiNzGXlJXL
mSknVWRdqvVKNJIWbCF5XZnN90k2Xc3tEQxse1M+pHjEG9YyBFm/SKSkfuSDFY0b
G3/O9zLD1dWHcmIGra65nHE6uFosCMUvZXByx50rMipyRRd/bOufEKwGoqq7d0wD
trqQMEf6vrMaZSDK3t0lIQ==
-----END PRIVATE KEY-----`

const PUBLIC_IP = "203.0.113.5" // Documentation range — a safe public stand-in.
const TEST_NET_V4 = "203.0.113.10"
const TEST_NET_V6 = "2001:db8::1"

const servers: Array<http.Server | https.Server> = []
const testNetV4 = await ensureLocalAddress(TEST_NET_V4, 4)
const testNetV6 = await ensureLocalAddress(TEST_NET_V6, 6)

afterEach(async () => {
  while (servers.length) await new Promise<void>((resolve) => servers.pop()!.close(() => resolve()))
  vi.restoreAllMocks()
})

function listen(server: http.Server | https.Server): Promise<number> {
  servers.push(server)
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)))
}

function listenOn(server: http.Server | https.Server, host: string): Promise<number> {
  servers.push(server)
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, host, () => resolve((server.address() as AddressInfo).port))
  })
}

async function canBind(address: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = http.createServer()
    server.once("error", () => resolve(false))
    server.listen(0, address, () => {
      server.close(() => resolve(true))
    })
  })
}

async function ensureLocalAddress(address: string, family: 4 | 6): Promise<boolean> {
  if (await canBind(address)) return true
  const commands: Array<[string, string[]]> =
    family === 4
      ? [
          ["ifconfig", ["lo:0", address, "netmask", "255.255.255.255", "up"]],
          ["sudo", ["-n", "ifconfig", "lo:0", address, "netmask", "255.255.255.255", "up"]],
          ["ip", ["addr", "add", `${address}/32`, "dev", "lo"]],
          ["sudo", ["-n", "ip", "addr", "add", `${address}/32`, "dev", "lo"]],
        ]
      : [
          ["ifconfig", ["lo", "inet6", "add", `${address}/128`]],
          ["sudo", ["-n", "ifconfig", "lo", "inet6", "add", `${address}/128`]],
          ["ip", ["-6", "addr", "add", `${address}/128`, "dev", "lo"]],
          ["sudo", ["-n", "ip", "-6", "addr", "add", `${address}/128`, "dev", "lo"]],
        ]
  for (const [command, args] of commands) {
    try {
      await execFileAsync(command, args)
    } catch {
      continue
    }
    if (await canBind(address)) return true
  }
  return canBind(address)
}

function rebindSystemLookup(address: string, family: 4 | 6) {
  const original = dns.lookup.bind(dns)
  return vi.spyOn(dns, "lookup").mockImplementation(((hostname: string, options: unknown, callback?: unknown) => {
    if (isIP(String(hostname))) {
      return original(hostname, options as never, callback as never)
    }
    const cb = (typeof options === "function" ? options : callback) as (
      err: NodeJS.ErrnoException | null,
      address: string | Array<{ address: string; family: number }>,
      family?: number,
    ) => void
    const opts = typeof options === "function" ? undefined : (options as { all?: boolean } | undefined)
    if (opts?.all) cb(null, [{ address, family }])
    else cb(null, address, family)
  }) as typeof dns.lookup)
}

async function expectCode(promise: Promise<unknown>, code: SafeOutboundCode) {
  await expect(promise).rejects.toMatchObject({ code })
  await promise.catch((error) => expect(error).toBeInstanceOf(SafeOutboundError))
}

// A fetch spy that returns queued Responses, recording the URLs it was asked to fetch.
function fetchSequence(responses: Response[]) {
  const requested: string[] = []
  let index = 0
  const impl = vi.fn(async (input: URL | RequestInfo) => {
    requested.push(input.toString())
    return responses[Math.min(index++, responses.length - 1)]
  }) as unknown as typeof fetch
  return { impl, requested }
}

describe("safe-outbound validation", () => {
  it("rejects credentials in the URL before any lookup or fetch", async () => {
    const resolve = vi.fn(async () => [PUBLIC_IP])
    const { impl } = fetchSequence([new Response("ok")])
    const client = createSafeOutboundClient({ resolve, fetchImpl: impl })
    await expectCode(client("https://user:pass@example.test/"), "credentials_in_url")
    expect(resolve).not.toHaveBeenCalled()
    expect(impl).not.toHaveBeenCalled()
  })

  it("rejects non-http(s) schemes", async () => {
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP] })
    await expectCode(client("ftp://example.test/"), "disallowed_scheme")
    await expectCode(client("file:///etc/passwd"), "disallowed_scheme")
  })

  it("restricts ports to the scheme default", async () => {
    const { impl } = fetchSequence([new Response("ok")])
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP], fetchImpl: impl })
    await expectCode(client("https://example.test:8443/"), "disallowed_port")
    await expectCode(client("http://example.test:8080/"), "disallowed_port")
    expect(impl).not.toHaveBeenCalled()
  })

  it("blocks private/loopback/metadata IP literals without resolving", async () => {
    const resolve = vi.fn(async () => [PUBLIC_IP])
    const client = createSafeOutboundClient({ resolve })
    for (const host of [
      "http://127.0.0.1/",
      "http://10.0.0.1/",
      "http://169.254.169.254/",
      "http://[::1]/",
      "http://[fc00::1]/",
      "http://[fe80::1]/",
      "http://[fd00:ec2::254]/",
    ]) {
      await expectCode(client(host), "blocked_address")
    }
    expect(resolve).not.toHaveBeenCalled()
  })

  it("blocks IPv4 shorthand (decimal/octal/hex) that normalises to loopback", async () => {
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP] })
    for (const host of ["http://2130706433/", "http://0x7f000001/", "http://0177.0.0.1/", "http://127.1/"]) {
      await expectCode(client(host), "blocked_address")
    }
  })

  it("blocks IPv4-mapped IPv6 loopback literals", async () => {
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP] })
    await expectCode(client("http://[::ffff:127.0.0.1]/"), "blocked_address")
  })

  it("rejects a resolved private address and never fetches", async () => {
    const { impl } = fetchSequence([new Response("ok")])
    const client = createSafeOutboundClient({ resolve: async () => ["10.0.0.5"], fetchImpl: impl })
    await expectCode(client("https://intranet.example/"), "blocked_address")
    expect(impl).not.toHaveBeenCalled()
  })

  it("rejects a mixed safe/unsafe answer set (DNS rebinding attempt)", async () => {
    const { impl } = fetchSequence([new Response("ok")])
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP, "169.254.169.254"], fetchImpl: impl })
    await expectCode(client("https://rebind.example/"), "blocked_address")
    expect(impl).not.toHaveBeenCalled()
  })

  it("normalises a trailing-dot host and passes punycode for IDNs", async () => {
    const resolve = vi.fn(async () => [PUBLIC_IP])
    const { impl } = fetchSequence([
      new Response("ok", { headers: { "content-type": "text/html" } }),
      new Response("ok", { headers: { "content-type": "text/html" } }),
    ])
    const client = createSafeOutboundClient({ resolve, fetchImpl: impl })
    await client("https://example.com./")
    expect(resolve).toHaveBeenCalledWith("example.com")
    await client("https://bücher.example/")
    expect(resolve).toHaveBeenCalledWith("xn--bcher-kva.example")
  })

  it("pins the exact validated address onto the dispatcher", async () => {
    const built: Array<{ address: string; family: number; hostname: string }> = []
    const { impl } = fetchSequence([new Response("ok")])
    const client = createSafeOutboundClient({
      resolve: async () => [PUBLIC_IP],
      fetchImpl: impl,
      buildDispatcher: (address, family, hostname) => {
        built.push({ address, family, hostname })
        return { close: async () => {} } as never
      },
    })
    await client("https://example.test/")
    expect(built).toEqual([{ address: PUBLIC_IP, family: 4, hostname: "example.test" }])
  })

  it("rejects a mixed IPv6 public/link-local answer set", async () => {
    const { impl } = fetchSequence([new Response("ok")])
    const client = createSafeOutboundClient({
      resolve: async () => ["2001:db8::1", "fe80::1"],
      fetchImpl: impl,
    })
    await expectCode(client("https://rebind6.example/"), "blocked_address")
    expect(impl).not.toHaveBeenCalled()
  })
})

describe("safe-outbound redirects", () => {
  it("independently revalidates a redirect to a metadata host", async () => {
    const { impl, requested } = fetchSequence([
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } }),
    ])
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP], fetchImpl: impl })
    await expectCode(client("https://example.test/"), "blocked_address")
    expect(requested).toHaveLength(1) // hop0 fetched; the redirect never connects
  })

  it("independently revalidates a redirect to a private hostname", async () => {
    const { impl, requested } = fetchSequence([
      new Response(null, { status: 301, headers: { location: "http://internal.example/" } }),
    ])
    const client = createSafeOutboundClient({
      resolve: async (host) => (host === "internal.example" ? ["10.0.0.9"] : [PUBLIC_IP]),
      fetchImpl: impl,
    })
    await expectCode(client("https://example.test/"), "blocked_address")
    expect(requested).toHaveLength(1)
  })

  it("enforces the redirect limit", async () => {
    const { impl } = fetchSequence([new Response(null, { status: 302, headers: { location: "https://example.test/next" } })])
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP], fetchImpl: impl })
    await expectCode(client("https://example.test/", { maxRedirects: 2 }), "redirect_limit")
  })
})

describe("safe-outbound limits", () => {
  it("rejects an over-sized response by declared content-length", async () => {
    const { impl } = fetchSequence([new Response("small", { headers: { "content-length": "5000000" } })])
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP], fetchImpl: impl })
    await expectCode(client("https://example.test/", { maxResponseBytes: 1000 }), "response_too_large")
  })

  it("rejects an over-sized response streamed without a trustworthy length", async () => {
    const big = "a".repeat(20_000)
    const impl = vi.fn(async () => new Response(big)) as unknown as typeof fetch
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP], fetchImpl: impl })
    await expectCode(client("https://example.test/", { maxResponseBytes: 1000 }), "response_too_large")
  })

  it("maps an aborted request to a timeout", async () => {
    const impl = vi.fn((_input: URL | RequestInfo, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))
      }),
    ) as unknown as typeof fetch
    const client = createSafeOutboundClient({ resolve: async () => [PUBLIC_IP], fetchImpl: impl })
    await expectCode(client("https://example.test/", { timeoutMs: 1000 }), "timeout")
  })
})

describe("safe-outbound production fetch boundary", () => {
  it("does not follow a DNS rebind to IPv4 loopback", async () => {
    const decoyHits: string[] = []
    const decoy = http.createServer((req, res) => {
      decoyHits.push(req.url || "")
      res.writeHead(200)
      res.end("REBOUND")
    })
    const port = await listen(decoy)
    const lookup = rebindSystemLookup("127.0.0.1", 4)

    const client = createSafeOutboundClient({ resolve: async () => [testNetV4 ? TEST_NET_V4 : PUBLIC_IP] })
    await expectCode(client(`http://rebind.example:${port}/secret`, { allowedPorts: { http: [String(port)], https: [] }, timeoutMs: 1000 }), "request_failed")
    expect(decoyHits).toEqual([])
    expect(lookup.mock.calls.some((call) => String(call[0]) === "rebind.example")).toBe(false)
  })

  it("does not follow a DNS rebind to IPv6 loopback", async () => {
    const decoyHits: string[] = []
    const decoy = http.createServer((req, res) => {
      decoyHits.push(req.url || "")
      res.writeHead(200)
      res.end("REBOUND")
    })
    servers.push(decoy)
    const port = await new Promise<number>((resolve) => decoy.listen(0, "::1", () => resolve((decoy.address() as AddressInfo).port)))
    rebindSystemLookup("::1", 6)

    const client = createSafeOutboundClient({ resolve: async () => ["2001:db8::1"] })
    await expectCode(client(`http://rebind6.example:${port}/secret`, { allowedPorts: { http: [String(port)], https: [] }, timeoutMs: 1000 }), "request_failed")
    expect(decoyHits).toEqual([])
  })

  it("does not follow a DNS rebind to the IPv4 metadata endpoint", async () => {
    const decoyHits: string[] = []
    const decoy = http.createServer((req, res) => {
      decoyHits.push(req.url || "")
      res.writeHead(200)
      res.end("METADATA")
    })
    const port = await listen(decoy)
    rebindSystemLookup("169.254.169.254", 4)

    const client = createSafeOutboundClient({ resolve: async () => [testNetV4 ? TEST_NET_V4 : PUBLIC_IP] })
    await expectCode(client(`http://metadata.example:${port}/latest/meta-data/`, { allowedPorts: { http: [String(port)], https: [] }, timeoutMs: 1000 }), "request_failed")
    expect(decoyHits).toEqual([])
  })

  it("keeps TLS verification intact against an untrusted certificate", async () => {
    const server = https.createServer({ cert: SELF_SIGNED_CERT, key: SELF_SIGNED_KEY }, (_req, res) => {
      res.writeHead(200)
      res.end("secret")
    })
    const port = await listen(server)

    const client = createSafeOutboundClient({
      resolve: async () => [PUBLIC_IP],
      // TLS fails during handshake, before the connected-address check, so a
      // loopback pin is enough to prove rejectUnauthorized stays enabled.
      buildDispatcher: () => buildPinnedDispatcher("127.0.0.1", 4, "example.test"),
    })
    await expectCode(
      client(`https://example.test:${port}/`, { allowedPorts: { http: [], https: [String(port)] } }),
      "request_failed",
    )
  })

  it.skipIf(!testNetV4)("connects to the pinned documentation-range address through the production dispatcher", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/next") {
        res.writeHead(200, { "content-type": "text/html" })
        res.end("<title>Final</title>")
        return
      }
      res.writeHead(302, { location: `http://example.test:${port}/next` })
      res.end()
    })
    const port = await listenOn(server, TEST_NET_V4)
    rebindSystemLookup("127.0.0.1", 4)

    const client = createSafeOutboundClient({ resolve: async () => [TEST_NET_V4] })
    const result = await client(`http://example.test:${port}/`, { allowedPorts: { http: [String(port)], https: [] } })
    expect(result.status).toBe(200)
    expect(result.body).toContain("Final")
    expect(result.redirects).toHaveLength(1)
    expect(result.url).toBe(`http://example.test:${port}/next`)
  })

  it.skipIf(!testNetV4)("revalidates a redirect to a metadata host on the production fetch boundary", async () => {
    const decoyHits: string[] = []
    const decoy = http.createServer((req, res) => {
      decoyHits.push(req.url || "")
      res.writeHead(200)
      res.end("METADATA")
    })
    await listen(decoy)

    const server = http.createServer((_req, res) => {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" })
      res.end()
    })
    const port = await listenOn(server, TEST_NET_V4)

    const client = createSafeOutboundClient({ resolve: async () => [TEST_NET_V4] })
    await expectCode(client(`http://example.test:${port}/`, { allowedPorts: { http: [String(port), "80"], https: [] } }), "blocked_address")
    expect(decoyHits).toEqual([])
  })

  it.skipIf(!testNetV4)("revalidates a redirect to a private hostname on the production fetch boundary", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(301, { location: "http://internal.example/" })
      res.end()
    })
    const port = await listenOn(server, TEST_NET_V4)
    const client = createSafeOutboundClient({
      resolve: async (host) => (host === "internal.example" ? ["10.0.0.9"] : [TEST_NET_V4]),
    })
    await expectCode(client(`http://example.test:${port}/`, { allowedPorts: { http: [String(port), "80"], https: [] } }), "blocked_address")
  })

  it.skipIf(!testNetV6)("connects to a pinned IPv6 documentation-range address", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200)
      res.end("v6-ok")
    })
    const port = await listenOn(server, TEST_NET_V6)
    const client = createSafeOutboundClient({ resolve: async () => [TEST_NET_V6] })
    const result = await client(`http://ipv6.example:${port}/`, { allowedPorts: { http: [String(port)], https: [] } })
    expect(result.status).toBe(200)
    expect(result.body).toBe("v6-ok")
  })
})
