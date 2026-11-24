import { test } from "node:test"
import assert from "node:assert/strict"
import { loadConfig, runWorker } from "./ascend-worker.mjs"

const token = "asc_" + "A".repeat(43)
const env = { ASCEND_WORKER_URL: "http://127.0.0.1:3301/api/ascend/worker", ASCEND_WORKER_TOKEN: token, ASCEND_WORKER_ID: "test-worker", ASCEND_WORKER_CONCURRENCY: "2", ASCEND_WORKER_IDLE_MS: "1000" }
const reply = (status, body) => Promise.resolve({ status, json: async () => body })

test("accepts only loopback HTTP or HTTPS endpoints with a well-formed token", () => {
  assert.deepEqual(loadConfig(env, []).problems, [])
  for (const url of ["http://10.0.0.5:3301/api/ascend/worker", "http://127.0.0.1:3201/api/megaton/worker", "https://u:p@admin.example/api/ascend/worker", "ftp://127.0.0.1/api/ascend/worker"])
    assert.ok(loadConfig({ ...env, ASCEND_WORKER_URL: url }, []).problems.length, url)
  assert.ok(loadConfig({ ...env, ASCEND_WORKER_TOKEN: "short" }, []).problems.some((p) => /TOKEN/.test(p)))
  assert.ok(loadConfig({ ...env, ASCEND_WORKER_CONCURRENCY: "9" }, []).problems.some((p) => /CONCURRENCY/.test(p)))
})

test("never logs the token and stops immediately when the identity is revoked", async () => {
  const lines = []; let calls = 0
  const result = await runWorker(loadConfig(env, []), { fetchImpl: () => { calls++; return reply(403, { error: "revoked" }) }, sleep: async () => {}, log: (l) => lines.push(l) })
  assert.equal(result.fatal, "http_403")
  assert.ok(calls <= 2, "both lanes stop instead of retrying a revoked identity")
  assert.ok(!lines.join("\n").includes(token))
})

test("backs off on server errors with growing delays, then drains on shutdown and reports stopped", async () => {
  const controller = new AbortController(); const delays = []; const statuses = []; let n = 0
  const fetchImpl = (_url, init) => {
    statuses.push(JSON.parse(init.body).status)
    n++
    if (n === 6) controller.abort()
    return reply(n < 5 ? 503 : 200, { claimed: null })
  }
  const result = await runWorker(loadConfig({ ...env, ASCEND_WORKER_CONCURRENCY: "1" }, []), { fetchImpl, sleep: async (ms) => { delays.push(ms) }, random: () => 1, log: () => {}, signal: controller.signal })
  assert.deepEqual(delays.slice(0, 4), [4000, 8000, 16000, 32000])
  assert.equal(result.stoppedBy, "signal")
  assert.equal(statuses.at(-1), "stopped")
})

test("--once performs one tick per lane for smoke tests", async () => {
  let calls = 0
  const result = await runWorker(loadConfig(env, ["--once"]), { fetchImpl: () => { calls++; return reply(200, { claimed: { id: "x", status: "completed" } }) }, sleep: async () => {}, log: () => {} })
  assert.equal(calls, 3) // two lanes plus the final "stopped" heartbeat
  assert.equal(result.executed, 2)
})
