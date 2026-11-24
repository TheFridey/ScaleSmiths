#!/usr/bin/env node
// Operation ASCEND B2.8 worker. A thin, supervised driver: all policy, leasing and execution happen server-side in the
// admin app under a scoped worker identity. This process only paces requests, reports its load and shuts down cleanly.
//
// Environment:
//   ASCEND_WORKER_URL           Admin worker endpoint, e.g. http://127.0.0.1:3301/api/ascend/worker (loopback HTTP or HTTPS only)
//   ASCEND_WORKER_TOKEN         Scoped worker token (asc_...). Never logged.
//   ASCEND_WORKER_ID            Stable identifier for this process (default: hostname-pid)
//   ASCEND_WORKER_CONCURRENCY   Parallel lanes, 1-8 (default 1)
//   ASCEND_WORKER_IDLE_MS       Base pause when no work is due (default 15000)
// Flags: --once (one tick per lane, then exit; for smoke tests)
import os from "node:os"
import { pathToFileURL } from "node:url"

export const VERSION = "b2.8.0"

export function loadConfig(env = process.env, argv = process.argv.slice(2)) {
  const problems = []
  let url
  try { url = new URL(env.ASCEND_WORKER_URL ?? "") } catch { problems.push("ASCEND_WORKER_URL must be a URL") }
  if (url) {
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    if (url.pathname !== "/api/ascend/worker") problems.push("ASCEND_WORKER_URL must end in /api/ascend/worker")
    if (!(url.protocol === "https:" || (url.protocol === "http:" && loopback))) problems.push("ASCEND_WORKER_URL must be HTTPS, or HTTP on loopback")
    if (url.username || url.password || url.search || url.hash) problems.push("ASCEND_WORKER_URL must not carry credentials, a query or a fragment")
  }
  const token = env.ASCEND_WORKER_TOKEN ?? ""
  if (!/^asc_[A-Za-z0-9_-]{43}$/.test(token)) problems.push("ASCEND_WORKER_TOKEN is missing or malformed")
  const workerId = env.ASCEND_WORKER_ID || `${os.hostname().replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 60)}-${process.pid}`
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/.test(workerId)) problems.push("ASCEND_WORKER_ID is invalid")
  const concurrency = Number(env.ASCEND_WORKER_CONCURRENCY ?? 1)
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) problems.push("ASCEND_WORKER_CONCURRENCY must be 1-8")
  const idleMs = Number(env.ASCEND_WORKER_IDLE_MS ?? 15000)
  if (!Number.isInteger(idleMs) || idleMs < 1000 || idleMs > 600000) problems.push("ASCEND_WORKER_IDLE_MS must be 1000-600000")
  return { problems, url: url?.toString(), token, workerId, concurrency, idleMs, once: argv.includes("--once") }
}

const jitter = (ms, random) => Math.round(ms / 2 + random() * (ms / 2))

/** Run until stopped. Returns a summary. `fetchImpl`, `sleep` and `random` are injectable for tests. */
export async function runWorker(config, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), random = Math.random, log = console.log, signal } = {}) {
  let stopping = false, fatal = null, inFlight = 0
  const summary = { ticks: 0, executed: 0, errors: 0, stoppedBy: null }
  const stop = (reason) => { if (!stopping) { stopping = true; summary.stoppedBy = reason; log(`[ascend-worker] stopping: ${reason}`) } }
  signal?.addEventListener("abort", () => stop("signal"))
  const post = async (status) => {
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify({ workerId: config.workerId, version: VERSION, maxConcurrency: config.concurrency, inFlight, status }),
      signal: AbortSignal.timeout(65000),
    })
    const body = await response.json().catch(() => ({}))
    return { status: response.status, body }
  }
  async function lane(index) {
    let failures = 0
    while (!stopping) {
      inFlight++
      let result
      try { result = await post("active") } catch (error) { result = { status: 0, body: { error: error?.name ?? "network_error" } } } finally { inFlight-- }
      summary.ticks++
      if (result.status === 200) {
        failures = 0
        const claimed = result.body?.claimed
        if (claimed) { summary.executed++; log(`[ascend-worker] lane ${index} ${claimed.id} -> ${claimed.status}`) }
        if (config.once) return
        if (!claimed) await sleep(jitter(config.idleMs, random))
        continue
      }
      summary.errors++
      // A revoked or invalid identity, or a disabled engine, will not fix itself: stop rather than hammer the API.
      if (result.status === 401 || result.status === 403 || result.status === 404) { fatal = `http_${result.status}`; stop(`identity or engine unavailable (HTTP ${result.status})`); return }
      if (config.once) return
      failures++
      const backoff = Math.min(300000, 2000 * 2 ** Math.min(failures, 8))
      log(`[ascend-worker] lane ${index} HTTP ${result.status || "network"}; retrying in ~${Math.round(backoff / 1000)}s`)
      await sleep(jitter(backoff, random))
    }
  }
  log(`[ascend-worker] ${config.workerId} v${VERSION} starting ${config.concurrency} lane(s)`)
  await Promise.all(Array.from({ length: config.concurrency }, (_, i) => lane(i)))
  // Tell the command centre this worker is gone, so it is not shown as stale. Best effort.
  if (!fatal) { try { await post("stopped") } catch { /* the heartbeat will simply age out */ } }
  return { ...summary, fatal }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const config = loadConfig()
  if (config.problems.length) { for (const p of config.problems) console.error(`[ascend-worker] config: ${p}`); process.exit(2) }
  const controller = new AbortController()
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => controller.abort())
  // In-flight ticks finish (each is bounded server-side); no new ones start once a signal arrives.
  const result = await runWorker(config, { signal: controller.signal })
  console.log(`[ascend-worker] stopped after ${result.ticks} tick(s), ${result.executed} execution(s), ${result.errors} error(s)`)
  process.exitCode = result.fatal ? 1 : 0
}
