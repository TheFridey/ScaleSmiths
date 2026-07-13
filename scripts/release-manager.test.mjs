import test from "node:test"
import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { ReleaseError, ReleaseManager } from "./release-manager.mjs"

async function fixture(options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "scalesmiths-release-"))
  const commands = []
  const runner = (argv) => {
    commands.push(argv.join(" "))
    if (options.failNginx && argv[0] === "nginx") throw new ReleaseError("invalid nginx")
    if (argv[0] === "curl") {
      const url = argv.at(-1)
      const service = url.includes(":3100") || url.includes(":3200") ? "scalesmiths-web" : "scalesmiths-admin"
      const release = url.includes("320") ? "release-green" : "release-blue"
      return JSON.stringify({ status: "ok", service, release })
    }
    return ""
  }
  const manager = new ReleaseManager({ root, repo: process.cwd(), upstreamPath: path.join(root, "nginx", "upstreams.conf"), runner, env: { SS_ENV_FILE: "/safe/.env", SS_GENERATED_SITES_DIR: "/safe/generated-sites", SS_PRODUCTION_NETWORK: "ss_ss-net", ADMIN_HEALTH_CHECK_TOKEN: "x".repeat(32) }, now: () => new Date("2026-07-13T12:00:00.000Z"), output: () => {} })
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

test("refuses to switch an incomplete or unknown release", async () => {
  const item = await fixture()
  try { await assert.rejects(item.manager.switch("missing", "owner@example.test"), /not prepared/) } finally { await item.cleanup() }
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
