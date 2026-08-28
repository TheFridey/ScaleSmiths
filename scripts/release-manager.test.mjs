import test from "node:test"
import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { ReleaseError, ReleaseManager } from "./release-manager.mjs"

async function fixture(options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "scalesmiths-release-"))
  const commands = []
  let curlCalls = 0
  let nginxCalls = 0
  const runner = (argv) => {
    commands.push(argv.join(" "))
    if (options.failWebBuild && argv[0] === "docker" && argv.includes("build") && argv.at(-1) === "web") throw new ReleaseError("simulated build failure containing private diagnostics")
    if (argv[0] === "nginx") { nginxCalls += 1; if (options.failNginx || options.failNginxCall === nginxCalls) throw new ReleaseError("invalid nginx") }
    if (argv[0] === "curl") {
      curlCalls += 1
      if (options.failCurlCall === curlCalls) throw new ReleaseError("private token=do-not-persist health diagnostics")
      const url = argv.at(-1)
      const service = url.includes(":3100") || url.includes(":3200") ? "scalesmiths-web" : "scalesmiths-admin"
      const release = url.includes("320") ? "release-green" : "release-blue"
      return JSON.stringify({ status: "ok", service, release })
    }
    return ""
  }
  const manager = new ReleaseManager({ root, repo: process.cwd(), upstreamPath: path.join(root, "nginx", "upstreams.conf"), runner, env: { SS_ENV_FILE: "/safe/.env", SS_GENERATED_SITES_DIR: "/safe/generated-sites", SS_PRODUCTION_NETWORK: "ss_ss-net", ADMIN_HEALTH_CHECK_TOKEN: "x".repeat(32), ...(options.env ?? {}) }, now: () => new Date("2026-07-13T12:00:00.000Z"), output: () => {} })
  return { root, commands, manager, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test("prepares a versioned inactive release only after validation and health", async () => {
  const item = await fixture()
  try {
    const release = await item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Blue release", slot: "blue" })
    assert.equal(release.status, "ready")
    assert.ok(item.commands.some((command) => command.includes("docker compose") && command.includes("config --quiet")))
    assert.ok(item.commands.some((command) => command.includes("--no-build web admin")))
    const record = JSON.parse(await readFile(path.join(item.root, "releases", "release-blue.json"), "utf8"))
    assert.equal(record.readyAt, "2026-07-13T12:00:00.000Z")
  } finally { await item.cleanup() }
})

test("passes source-map credentials to Docker as a secret without logging the token", async () => {
  const token = "private-sentry-auth-token"
  const item = await fixture({ env: { ERROR_MONITORING_RELEASE: "0".repeat(40), SENTRY_ORG: "scalesmiths", SENTRY_WEB_PROJECT: "web", SENTRY_ADMIN_PROJECT: "admin", SENTRY_AUTH_TOKEN: token } })
  try {
    await item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Blue release", slot: "blue" })
    const buildCommands = item.commands.filter((command) => command.startsWith("docker build"))
    assert.equal(buildCommands.length, 2)
    assert.ok(buildCommands.every((command) => command.includes("--secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN")))
    assert.ok(buildCommands.every((command) => !command.includes(token)))
    assert.ok(buildCommands.some((command) => command.includes("SENTRY_WEB_PROJECT=web")))
    assert.ok(buildCommands.some((command) => command.includes("SENTRY_ADMIN_PROJECT=admin")))
  } finally { await item.cleanup() }
})

test("refuses to switch an incomplete or unknown release", async () => {
  const item = await fixture()
  try { await assert.rejects(item.manager.switch("missing", "owner@example.test"), /not prepared/) } finally { await item.cleanup() }
})

test("persists a safe failed preparation record and audit event", async () => {
  const item = await fixture({ failWebBuild: true })
  try {
    await assert.rejects(item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Blue release", slot: "blue" }), /simulated build failure/)
    const record = JSON.parse(await readFile(path.join(item.root, "releases", "release-blue.json"), "utf8"))
    assert.equal(record.status, "failed")
    assert.equal(record.failureStage, "web_image_build")
    assert.equal(record.failedAt, "2026-07-13T12:00:00.000Z")
    const audit = await readFile(path.join(item.root, "deployments.jsonl"), "utf8")
    assert.match(audit, /"event":"release_prepare_failed"/)
    assert.match(audit, /"failureStage":"web_image_build"/)
    assert.doesNotMatch(audit, /private diagnostics/)
  } finally { await item.cleanup() }
})

test("adopts and retains the existing working slot before the first canary", async () => {
  const item = await fixture()
  try {
    await item.manager.adopt({ releaseId: "legacy-blue", actor: "owner@example.test", notes: "Existing production", slot: "blue" })
    assert.deepEqual(await item.manager.loadState(), { activeReleaseId: "legacy-blue", previousReleaseId: null, switchedAt: "2026-07-13T12:00:00.000Z", actor: "owner@example.test" })
  } finally { await item.cleanup() }
})

test("switches traffic only after health and nginx validation", async () => {
  const item = await fixture()
  try {
    await item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Blue release", slot: "blue" })
    await item.manager.switch("release-blue", "owner@example.test")
    const upstream = await readFile(path.join(item.root, "nginx", "upstreams.conf"), "utf8")
    assert.match(upstream, /127\.0\.0\.1:3100/)
    assert.ok(item.commands.includes("nginx -t"))
    assert.ok(item.commands.includes("systemctl reload nginx"))
  } finally { await item.cleanup() }
})

test("restores the previous upstream if nginx validation fails", async () => {
  const item = await fixture({ failNginx: true })
  try {
    const upstreamPath = path.join(item.root, "nginx", "upstreams.conf")
    await item.manager.action("seed", async () => { await mkdir(path.dirname(upstreamPath), { recursive: true }); await writeFile(upstreamPath, "previous-working-upstream\n", "utf8") })
    await item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Blue release", slot: "blue" })
    await assert.rejects(item.manager.switch("release-blue", "owner@example.test"), /previous upstream was restored/)
    assert.equal(await readFile(upstreamPath, "utf8"), "previous-working-upstream\n")
    assert.deepEqual(await item.manager.loadState(), {})
    const audit = await readFile(path.join(item.root, "deployments.jsonl"), "utf8")
    assert.match(audit, /"event":"release_switch_failed"/)
    assert.match(audit, /"failureStage":"nginx_switch"/)
  } finally { await item.cleanup() }
})

test("retains the previous release and supports fast rollback", async () => {
  const item = await fixture()
  try {
    await item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Blue", slot: "blue" })
    await item.manager.switch("release-blue", "owner@example.test")
    await item.manager.prepare({ releaseId: "release-green", actor: "owner@example.test", notes: "Green", slot: "green" })
    await item.manager.switch("release-green", "owner@example.test")
    const rolledBack = await item.manager.rollback("owner@example.test")
    assert.equal(rolledBack.activeReleaseId, "release-blue")
    assert.equal(rolledBack.previousReleaseId, "release-green")
  } finally { await item.cleanup() }
})

test("dry-run performs no filesystem or command mutation", async () => {
  const item = await fixture()
  try {
    let commandCalled = false
    const manager = new ReleaseManager({ root: path.join(item.root, "dry"), repo: process.cwd(), upstreamPath: path.join(item.root, "dry-upstream"), runner: () => { commandCalled = true; return "" }, dryRun: true, output: () => {} })
    await manager.prepare({ releaseId: "dry-release", actor: "owner@example.test", notes: "Dry run", slot: "green" })
    assert.equal(commandCalled, false)
    assert.equal(await manager.loadState().then((state) => Object.keys(state).length), 0)
  } finally { await item.cleanup() }
})

test("records preflight failure as a terminal attempt", async () => {
  const item = await fixture()
  try {
    item.manager.runner = (argv) => { if (argv.includes("config")) throw new ReleaseError("password=do-not-persist"); return "" }
    await assert.rejects(item.manager.prepare({ releaseId: "preflight", actor: "owner@example.test", notes: "Preflight", slot: "blue" }))
    const record = JSON.parse(await readFile(path.join(item.root, "releases", "preflight.json"), "utf8"))
    assert.equal(record.failureCategory, "preflight")
    assert.equal(record.gateOutcomes[0].status, "failed")
    assert.doesNotMatch(JSON.stringify(record), /do-not-persist/)
  } finally { await item.cleanup() }
})

test("records deployment failure with source, versions, and a safe summary", async () => {
  const item = await fixture({ failWebBuild: true, env: { GIT_COMMIT_SHA: "a".repeat(40) } })
  try {
    await assert.rejects(item.manager.prepare({ releaseId: "deploy-fail", actor: "owner@example.test", notes: "Deploy", slot: "blue" }))
    const record = JSON.parse(await readFile(path.join(item.root, "releases", "deploy-fail.json"), "utf8"))
    assert.equal(record.failureCategory, "deployment")
    assert.equal(record.sourceCommit, "a".repeat(40))
    assert.equal(record.safeErrorSummary, "Web image build failed.")
  } finally { await item.cleanup() }
})

test("records inactive health-check failure without persisting diagnostics", async () => {
  const item = await fixture({ failCurlCall: 1 })
  try {
    await assert.rejects(item.manager.prepare({ releaseId: "health-fail", actor: "owner@example.test", notes: "Health", slot: "blue" }))
    const record = JSON.parse(await readFile(path.join(item.root, "releases", "health-fail.json"), "utf8"))
    assert.equal(record.failureCategory, "health_check")
    assert.equal(record.failureStage, "inactive_health_check")
    assert.doesNotMatch(JSON.stringify(record), /do-not-persist/)
  } finally { await item.cleanup() }
})

test("records rollback success on the release being replaced", async () => {
  const item = await fixture()
  try {
    await item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Blue", slot: "blue" }); await item.manager.switch("release-blue", "owner@example.test")
    await item.manager.prepare({ releaseId: "release-green", actor: "owner@example.test", notes: "Green", slot: "green" }); await item.manager.switch("release-green", "owner@example.test")
    await item.manager.rollback("owner@example.test")
    const record = JSON.parse(await readFile(path.join(item.root, "releases", "release-green.json"), "utf8"))
    assert.equal(record.rollback.outcome, "succeeded")
    assert.equal(record.resultingActiveVersion, "release-blue")
  } finally { await item.cleanup() }
})

test("records rollback failure durably", async () => {
  const item = await fixture()
  try {
    await item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Blue", slot: "blue" }); await item.manager.switch("release-blue", "owner@example.test")
    await item.manager.prepare({ releaseId: "release-green", actor: "owner@example.test", notes: "Green", slot: "green" }); await item.manager.switch("release-green", "owner@example.test")
    item.manager.installUpstreams = async () => { throw new ReleaseError("secret=do-not-persist") }
    await assert.rejects(item.manager.rollback("owner@example.test"))
    const record = JSON.parse(await readFile(path.join(item.root, "releases", "release-green.json"), "utf8"))
    assert.equal(record.rollback.outcome, "failed")
    assert.equal(record.failureCategory, "rollback")
    assert.doesNotMatch(JSON.stringify(record), /do-not-persist/)
  } finally { await item.cleanup() }
})

test("records cancellation and distinguishes an explicit retry", async () => {
  const item = await fixture()
  try {
    const prepared = await item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Cancel", slot: "blue" })
    await item.manager.cancel("release-blue", "owner@example.test", "Change window closed; token=do-not-persist")
    const retry = await item.manager.prepare({ releaseId: "release-blue", actor: "owner@example.test", notes: "Retry", slot: "blue", retryOfAttemptId: prepared.attemptId })
    assert.equal(retry.attemptId, "release-blue:2")
    assert.equal(retry.retryOfAttemptId, "release-blue:1")
    const archived = await readFile(path.join(item.root, "attempts", "release-blue-1.json"), "utf8")
    assert.match(archived, /"outcome": "cancelled"/)
    const audit = await readFile(path.join(item.root, "deployments.jsonl"), "utf8")
    assert.doesNotMatch(audit, /do-not-persist/)
  } finally { await item.cleanup() }
})
