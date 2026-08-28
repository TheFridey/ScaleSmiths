// Executable assertions for the host-Nginx production topology. Runs inside the
// `tester` container on the harness network, driving the same shared snippets
// production uses. Source IPs are fixed by docker-compose.nginx-test.yml so the
// Cloudflare trust assertions are deterministic. See
// docs/operations/nginx-testing.md.
import test from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import https from "node:https"

const NGINX = process.env.NGINX_HOST ?? "nginx"
const EDGE = process.env.EDGE_HOST ?? "edge"
const CF_CLIENT_IP = "203.0.113.7" // The visitor IP the simulated edge injects.

// Low-level request so we control the Host header and can observe a 444 (Nginx
// closing the connection with no response) as `closed: true`.
function request({ target = NGINX, tls = false, method = "GET", path = "/", host, headers = {}, body } = {}) {
  const lib = tls ? https : http
  const port = tls ? 443 : 80
  const options = {
    host: target,
    port,
    method,
    path,
    headers: { ...(host ? { Host: host } : {}), ...headers },
  }
  if (tls) {
    options.servername = host ?? target
    options.rejectUnauthorized = false
  }
  return new Promise((resolve) => {
    const req = lib.request(options, (res) => {
      const chunks = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8"), closed: false }),
      )
    })
    req.on("error", (error) => resolve({ status: 0, headers: {}, body: "", closed: true, error: error.code }))
    if (body) req.write(body)
    req.end()
  })
}

function json(response) {
  return JSON.parse(response.body)
}

test("public domain routes to the web application", async () => {
  const res = await request({ tls: true, host: "scalesmiths.co.uk", path: "/" })
  assert.equal(res.status, 200)
  assert.equal(res.headers["x-mock-app"], "web")
  assert.equal(json(res).app, "web")
})

test("www is canonicalised to the apex origin over HTTP", async () => {
  const res = await request({ tls: false, host: "www.scalesmiths.co.uk", path: "/pricing" })
  assert.equal(res.status, 301)
  assert.equal(res.headers["location"], "https://scalesmiths.co.uk/pricing")
})

test("HTTP is redirected to HTTPS for the public domain", async () => {
  const res = await request({ tls: false, host: "scalesmiths.co.uk", path: "/" })
  assert.equal(res.status, 301)
  assert.ok(res.headers["location"].startsWith("https://scalesmiths.co.uk"), res.headers["location"])
})

test("HTTP is redirected to HTTPS for the admin subdomain", async () => {
  const res = await request({ tls: false, host: "admin.scalesmiths.co.uk", path: "/" })
  assert.equal(res.status, 301)
  assert.ok(res.headers["location"].startsWith("https://admin.scalesmiths.co.uk"), res.headers["location"])
})

test("admin subdomain routes to the admin application", async () => {
  const res = await request({ tls: true, host: "admin.scalesmiths.co.uk", path: "/" })
  assert.equal(res.status, 200)
  assert.equal(res.headers["x-mock-app"], "admin")
  assert.equal(json(res).app, "admin")
})

test("admin requests never reach the public web application", async () => {
  // Sweep several paths; the admin host must never be answered by the web mock.
  for (const path of ["/", "/forge", "/api/session", "/anything"]) {
    const res = await request({ tls: true, host: "admin.scalesmiths.co.uk", path })
    assert.notEqual(res.headers["x-mock-app"], "web", `admin ${path} was served by web`)
    assert.equal(res.headers["x-mock-app"], "admin", `admin ${path} not served by admin`)
  }
})

test("/admin on the public domain is a web path, not the production admin app", async () => {
  const res = await request({ tls: true, host: "scalesmiths.co.uk", path: "/admin" })
  assert.equal(res.status, 200)
  assert.equal(res.headers["x-mock-app"], "web")
  const payload = json(res)
  assert.equal(payload.app, "web")
  assert.equal(payload.url, "/admin")
})

test("security headers are present on the public app", async () => {
  const res = await request({ tls: true, host: "scalesmiths.co.uk", path: "/" })
  assert.match(res.headers["strict-transport-security"] ?? "", /max-age=31536000/)
  assert.equal(res.headers["x-frame-options"], "DENY")
  assert.equal(res.headers["x-content-type-options"], "nosniff")
})

test("security headers are present on the admin app", async () => {
  const res = await request({ tls: true, host: "admin.scalesmiths.co.uk", path: "/" })
  assert.match(res.headers["strict-transport-security"] ?? "", /max-age=31536000/)
  assert.equal(res.headers["x-frame-options"], "DENY")
  assert.equal(res.headers["x-content-type-options"], "nosniff")
})

test("public app overwrites the client-supplied X-Forwarded-For chain", async () => {
  const res = await request({
    tls: true,
    host: "scalesmiths.co.uk",
    path: "/",
    headers: { "X-Forwarded-For": "10.9.9.9" },
  })
  const forwarded = json(res).headers
  assert.equal(forwarded["x-forwarded-proto"], "https")
  // scalesmiths.co.uk is a direct origin, so the supplied chain is untrusted and
  // dropped entirely. Appending it (the previous behaviour) let a visitor choose
  // its own rate-limit bucket by sending any address it liked.
  assert.ok(!forwarded["x-forwarded-for"].includes("10.9.9.9"), forwarded["x-forwarded-for"])
  assert.equal(forwarded["x-forwarded-for"], forwarded["x-real-ip"])
})

test("admin app overwrites the client-supplied X-Forwarded-For chain", async () => {
  const res = await request({
    tls: true,
    host: "admin.scalesmiths.co.uk",
    path: "/",
    headers: { "X-Forwarded-For": "10.9.9.9" },
  })
  const forwarded = json(res).headers
  assert.equal(forwarded["x-forwarded-proto"], "https")
  assert.equal(forwarded["x-forwarded-host"], "admin.scalesmiths.co.uk")
  // Direct origin drops the untrusted chain: only the immediate peer remains.
  assert.ok(!forwarded["x-forwarded-for"].includes("10.9.9.9"), forwarded["x-forwarded-for"])
  assert.equal(forwarded["x-forwarded-for"], forwarded["x-real-ip"])
})

test("websocket upgrade headers are forwarded upstream", async () => {
  const res = await request({
    tls: true,
    host: "scalesmiths.co.uk",
    path: "/",
    headers: { Upgrade: "websocket", Connection: "Upgrade" },
  })
  const forwarded = json(res).headers
  assert.equal(forwarded["upgrade"], "websocket")
  assert.equal(forwarded["connection"], "upgrade")
})

test("health endpoints return 200 through Nginx", async () => {
  for (const host of ["scalesmiths.co.uk", "admin.scalesmiths.co.uk"]) {
    const res = await request({ tls: true, host, path: "/api/health" })
    assert.equal(res.status, 200, host)
    assert.equal(json(res).status, "ok", host)
  }
})

test("request bodies larger than the limit are rejected with 413", async () => {
  const res = await request({
    tls: true,
    host: "scalesmiths.co.uk",
    path: "/",
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: Buffer.alloc(11 * 1024 * 1024, 0x61), // 11 MiB > 10m limit
  })
  assert.equal(res.status, 413)
})

test("upstream failures return the controlled error page, not a raw error", async () => {
  const res = await request({ tls: true, host: "down.scalesmiths.co.uk", path: "/" })
  assert.equal(res.status, 502)
  assert.equal(res.headers["x-scalesmiths-error"], "upstream")
  assert.match(res.body, /temporarily unavailable/i)
})

test("generated marketing sites are never served from the public origin", async () => {
  const res = await request({
    tls: true,
    host: "scalesmiths.co.uk",
    path: "/generated-sites/1-nottingham-homecare-repairs/index.html",
  })
  assert.equal(res.status, 404)
  // Must be refused by Nginx, never proxied to the web app.
  assert.notEqual(res.headers["x-mock-app"], "web")
})

test("unknown hosts are rejected (connection dropped)", async () => {
  const overTls = await request({ tls: true, host: "evil.example.com", path: "/" })
  assert.equal(overTls.closed, true, "unknown host over TLS was not dropped")
  const overHttp = await request({ tls: false, host: "evil.example.com", path: "/" })
  assert.equal(overHttp.closed, true, "unknown host over HTTP was not dropped")
})

test("Cloudflare: CF-Connecting-IP from a trusted edge is honoured", async () => {
  // Through the trusted edge (fixed IP inside the trusted CIDR).
  const res = await request({ target: EDGE, tls: false, path: "/" })
  assert.equal(res.status, 200)
  assert.equal(res.headers["x-mock-app"], "admin")
  const forwarded = json(res).headers
  // real_ip promoted the edge-supplied visitor IP to the client address.
  assert.equal(forwarded["x-real-ip"], CF_CLIENT_IP)
  assert.equal(forwarded["cf-connecting-ip"], CF_CLIENT_IP)
})

test("Cloudflare: CF-Connecting-IP from an untrusted origin is not trusted", async () => {
  // Directly at Nginx (untrusted peer), spoofing the header.
  const res = await request({
    tls: false,
    host: "admin-cf.scalesmiths.co.uk",
    path: "/",
    headers: { "CF-Connecting-IP": CF_CLIENT_IP },
  })
  // Origin-peer check drops non-Cloudflare sources; the spoofed IP is ignored.
  assert.equal(res.closed, true, "untrusted origin was not rejected")
})

// ── Edge rate limiting ──────────────────────────────────────────────────
// The public origin is NOT behind Cloudflare, so these zones are its only
// volumetric protection. Limits are per exact peer address; because every
// request from the harness shares one source IP, a rapid burst deterministically
// exhausts the zone. Rates are r/m, so a burst cannot be refilled mid-test.

async function burst(options, count) {
  const responses = []
  for (let index = 0; index < count; index += 1) responses.push(await request(options))
  return responses
}

test("public quote submissions are rate limited at the edge with 429", async () => {
  const responses = await burst(
    { tls: true, host: "scalesmiths.co.uk", method: "POST", path: "/api/quote", headers: { "Content-Type": "application/json" }, body: "{}" },
    40,
  )
  const limited = responses.filter((res) => res.status === 429)
  assert.ok(limited.length > 0, "quote endpoint was never rate limited")
  // 429, not 503: nginx defaults to 503, which tells a client nothing useful.
  assert.ok(responses.every((res) => res.status !== 503), "quote limiter answered 503 instead of 429")
  assert.equal(limited[0].headers["retry-after"], "60")
})

test("portal login is rate limited at the edge with 429", async () => {
  const responses = await burst(
    { tls: true, host: "scalesmiths.co.uk", method: "POST", path: "/portal/api/login", headers: { "Content-Type": "application/json" }, body: "{}" },
    40,
  )
  const limited = responses.filter((res) => res.status === 429)
  assert.ok(limited.length > 0, "portal login was never rate limited")
  assert.equal(limited[0].headers["retry-after"], "60")
})

test("admin authentication endpoints are rate limited at the edge", async () => {
  const responses = await burst(
    { tls: true, host: "admin.scalesmiths.co.uk", method: "POST", path: "/api/auth/callback/credentials", headers: { "Content-Type": "application/json" }, body: "{}" },
    60,
  )
  const limited = responses.filter((res) => res.status === 429)
  assert.ok(limited.length > 0, "admin auth endpoint was never rate limited")
  assert.equal(limited[0].headers["retry-after"], "60")
})

test("ordinary page traffic is not rate limited", async () => {
  // A real visitor loading pages must never be throttled by the auth/quote
  // zones. Only the concurrency guard applies to `location /`.
  const responses = await burst({ tls: true, host: "scalesmiths.co.uk", path: "/pricing" }, 40)
  assert.ok(
    responses.every((res) => res.status === 200),
    `page traffic was throttled: ${responses.filter((r) => r.status !== 200).map((r) => r.status).join(",")}`,
  )
})
