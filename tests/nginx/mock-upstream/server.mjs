// Disposable mock upstream used behind the Nginx test harness for both the web
// and admin roles. It never talks to a database or the network: it simply
// reflects what Nginx forwarded so the assertion suite can prove routing and
// header handling. The APP_NAME env var (`web` | `admin`) is the identity marker
// that makes a misroute detectable.
import { createServer } from "node:http"

const appName = process.env.APP_NAME ?? "unknown"
const port = Number(process.env.PORT ?? 80)

const server = createServer((req, res) => {
  // Health endpoint answers directly, mirroring the app contract.
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "content-type": "application/json", "x-mock-app": appName })
    res.end(JSON.stringify({ status: "ok", app: appName }))
    return
  }

  // Drain the body so oversized-request behaviour is exercised end to end; Nginx
  // rejects anything past client_max_body_size before it ever reaches here.
  let bytes = 0
  req.on("data", (chunk) => {
    bytes += chunk.length
  })
  req.on("end", () => {
    const payload = {
      app: appName,
      method: req.method,
      url: req.url,
      bodyBytes: bytes,
      headers: {
        host: req.headers["host"] ?? null,
        "x-real-ip": req.headers["x-real-ip"] ?? null,
        "x-forwarded-for": req.headers["x-forwarded-for"] ?? null,
        "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? null,
        "x-forwarded-host": req.headers["x-forwarded-host"] ?? null,
        upgrade: req.headers["upgrade"] ?? null,
        connection: req.headers["connection"] ?? null,
        "cf-connecting-ip": req.headers["cf-connecting-ip"] ?? null,
      },
    }
    res.writeHead(200, { "content-type": "application/json", "x-mock-app": appName })
    res.end(JSON.stringify(payload))
  })
})

server.listen(port, () => {
  process.stdout.write(`mock upstream '${appName}' listening on ${port}\n`)
})
