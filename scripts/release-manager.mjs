#!/usr/bin/env node
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const RELEASE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/
const SLOT_PORTS = { blue: { web: 3100, admin: 3101 }, green: { web: 3200, admin: 3201 } }

export class ReleaseError extends Error {}

export class ReleaseManager {
  constructor(options = {}) {
    this.root = path.resolve(options.root ?? "/var/lib/scalesmiths-release")
    this.repo = path.resolve(options.repo ?? process.cwd())
    this.upstreamPath = path.resolve(options.upstreamPath ?? "/etc/nginx/scalesmiths/upstreams.conf")
    this.runner = options.runner ?? runCommand
    this.dryRun = Boolean(options.dryRun)
    this.env = { ...process.env, ...(options.env ?? {}) }
    this.now = options.now ?? (() => new Date())
    this.output = options.output ?? console.log
  }

  async prepare({ releaseId, actor, notes, slot }) {
    validateReleaseInput({ releaseId, actor, notes, slot })
    const recordPath = this.recordPath(releaseId)
    if (existsSync(recordPath)) throw new ReleaseError(`Release ${releaseId} already exists.`)
    const ports = SLOT_PORTS[slot]
    const release = { releaseId, actor, notes, slot, ports, status: "preparing", createdAt: this.now().toISOString(), readyAt: null, switchedAt: null }
    await this.action(`create release record ${recordPath}`, async () => { await mkdir(path.dirname(recordPath), { recursive: true }); await writeJsonAtomic(recordPath, release) })
    const env = this.releaseEnvironment(release)
    await this.command("validate Compose configuration", ["docker", "compose", "-f", "docker-compose.release.yml", "config", "--quiet"], env)
    await this.command("build versioned web image", ["docker", "build", "--pull", "-t", `scalesmiths-web:${releaseId}`, "web"], env)
    await this.command("build versioned admin image", ["docker", "build", "--pull", "-t", `scalesmiths-admin:${releaseId}`, "admin"], env)
    await this.command("start inactive release containers", ["docker", "compose", "-p", composeProject(releaseId), "-f", "docker-compose.release.yml", "up", "-d", "--no-build", "web", "admin"], env)
    await this.healthCheck(release)
    release.status = "ready"; release.readyAt = this.now().toISOString()
    await this.action(`mark release ${releaseId} ready`, () => writeJsonAtomic(recordPath, release))
    await this.log("release_prepared", release, { healthVerified: true })
    return release
  }

  async adopt({ releaseId, actor, notes, slot }) {
    validateReleaseInput({ releaseId, actor, notes, slot })
    if (existsSync(this.recordPath(releaseId))) throw new ReleaseError(`Release ${releaseId} already exists.`)
    const release = { releaseId, actor, notes, slot, ports: SLOT_PORTS[slot], status: "active", createdAt: this.now().toISOString(), readyAt: this.now().toISOString(), switchedAt: this.now().toISOString(), verifyRelease: false, adopted: true }
    await this.healthCheck(release)
    await this.action("adopt existing working release", async () => { await writeJsonAtomic(this.recordPath(releaseId), release); await writeJsonAtomic(this.statePath(), { activeReleaseId: releaseId, previousReleaseId: null, switchedAt: release.switchedAt, actor }) })
    await this.log("release_adopted", release, { actor, postReleaseVerified: true })
    return release
  }

  async switch(releaseId, actor) {
    requireActor(actor)
    const release = await this.loadReady(releaseId)
    await this.healthCheck(release)
    const state = await this.loadState()
    if (state.activeReleaseId === releaseId) throw new ReleaseError(`Release ${releaseId} is already active.`)
    await this.installUpstreams(release)
    const nextState = { activeReleaseId: releaseId, previousReleaseId: state.activeReleaseId ?? null, switchedAt: this.now().toISOString(), actor }
    release.status = "active"; release.switchedAt = nextState.switchedAt
    await this.action("persist active/previous release state", async () => { await writeJsonAtomic(this.statePath(), nextState); await writeJsonAtomic(this.recordPath(releaseId), release) })
    await this.healthCheck(release)
    if (this.env.SS_PUBLIC_HEALTH_URL) await this.command("verify public web health", ["curl", "--fail", "--silent", "--show-error", "--max-time", "15", this.env.SS_PUBLIC_HEALTH_URL])
    await this.log("release_switched", release, { actor, previousReleaseId: nextState.previousReleaseId, postReleaseVerified: true })
    return nextState
  }

  async rollback(actor) {
    requireActor(actor)
    const state = await this.loadState()
    if (!state.previousReleaseId) throw new ReleaseError("No retained previous release is available for rollback.")
    const target = await this.loadReady(state.previousReleaseId, true)
    await this.healthCheck(target)
    await this.installUpstreams(target)
    const next = { activeReleaseId: target.releaseId, previousReleaseId: state.activeReleaseId, switchedAt: this.now().toISOString(), actor }
    target.status = "active"; target.switchedAt = next.switchedAt
    await this.action("persist rollback state", async () => { await writeJsonAtomic(this.statePath(), next); await writeJsonAtomic(this.recordPath(target.releaseId), target) })
    await this.healthCheck(target)
    await this.log("release_rolled_back", target, { actor, replacedReleaseId: state.activeReleaseId, postReleaseVerified: true })
    return next
  }

  async installUpstreams(release) {
    const candidate = renderUpstreams(release.ports)
    if (this.dryRun) { this.output(`[dry-run] atomically switch ${this.upstreamPath} to ${release.releaseId}; nginx -t; reload nginx`); return }
    await mkdir(path.dirname(this.upstreamPath), { recursive: true })
    const old = existsSync(this.upstreamPath) ? await readFile(this.upstreamPath, "utf8") : null
    const candidatePath = `${this.upstreamPath}.candidate-${process.pid}`
    await writeFile(candidatePath, candidate, { encoding: "utf8", mode: 0o644 })
    await rename(candidatePath, this.upstreamPath)
    try {
      this.runner(["nginx", "-t"], { env: this.env })
      this.runner(["systemctl", "reload", "nginx"], { env: this.env })
    } catch (error) {
      if (old === null) await rm(this.upstreamPath, { force: true }); else await writeFile(this.upstreamPath, old, "utf8")
      try { this.runner(["nginx", "-t"], { env: this.env }); this.runner(["systemctl", "reload", "nginx"], { env: this.env }) } catch {}
      throw new ReleaseError(`Nginx switch failed and the previous upstream was restored: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async healthCheck(release) {
    const web = this.runnerOrPlan(["curl", "--fail", "--silent", "--show-error", "--max-time", "10", `http://127.0.0.1:${release.ports.web}/api/health`])
    const adminArgs = ["curl", "--fail", "--silent", "--show-error", "--max-time", "10"]
    const curlInput = this.env.ADMIN_HEALTH_CHECK_TOKEN ? `header = "x-health-check-token: ${this.env.ADMIN_HEALTH_CHECK_TOKEN.replace(/[\r\n"]/g, "")}"\n` : undefined
    if (curlInput) adminArgs.push("--config", "-")
    adminArgs.push(`http://127.0.0.1:${release.ports.admin}/api/health`)
    const admin = this.runnerOrPlan(adminArgs, curlInput)
    if (!this.dryRun) {
      assertHealth(web, "scalesmiths-web", release.verifyRelease === false ? null : release.releaseId)
      assertHealth(admin, "scalesmiths-admin", release.verifyRelease === false ? null : release.releaseId)
    }
  }

  releaseEnvironment(release) { return { ...this.env, SS_RELEASE_ID: release.releaseId, SS_WEB_PORT: String(release.ports.web), SS_ADMIN_PORT: String(release.ports.admin) } }
  async command(label, argv, env = this.env) { if (this.dryRun) { this.output(`[dry-run] ${label}: ${argv.join(" ")}`); return "" } return this.runner(argv, { cwd: this.repo, env }) }
  runnerOrPlan(argv, input) { if (this.dryRun) { this.output(`[dry-run] health: ${argv.map(redactArg).join(" ")}`); return "" } return this.runner(argv, { env: this.env, input }) }
  async action(label, fn) { if (this.dryRun) { this.output(`[dry-run] ${label}`); return } await fn() }
  recordPath(id) { return path.join(this.root, "releases", `${id}.json`) }
  statePath() { return path.join(this.root, "state.json") }
  async loadState() { return existsSync(this.statePath()) ? JSON.parse(await readFile(this.statePath(), "utf8")) : {} }
  async loadReady(id, allowActive = false) { if (!RELEASE_ID.test(id)) throw new ReleaseError("Invalid release ID."); if (!existsSync(this.recordPath(id))) throw new ReleaseError(`Release ${id} is not prepared.`); const release = JSON.parse(await readFile(this.recordPath(id), "utf8")); if (release.status !== "ready" && !(allowActive && release.status === "active")) throw new ReleaseError(`Release ${id} is not a verified ready release.`); return release }
  async log(event, release, detail) { await this.action(`append deployment log ${event}`, async () => { await mkdir(this.root, { recursive: true }); await writeFile(path.join(this.root, "deployments.jsonl"), `${JSON.stringify({ event, releaseId: release.releaseId, actor: detail.actor ?? release.actor, timestamp: this.now().toISOString(), notes: release.notes, ...detail })}\n`, { flag: "a" }) }) }
}

export function renderUpstreams(ports) { return `# Managed atomically by ScaleSmiths release manager.\nupstream scalesmiths_web {\n  server 127.0.0.1:${ports.web};\n  keepalive 16;\n}\n\nupstream scalesmiths_admin {\n  server 127.0.0.1:${ports.admin};\n  keepalive 16;\n}\n` }
function validateReleaseInput({ releaseId, actor, notes, slot }) { if (!RELEASE_ID.test(releaseId)) throw new ReleaseError("Release ID must contain only letters, numbers, dot, underscore or hyphen."); if (!actor?.trim()) throw new ReleaseError("Release actor is required."); if (!notes?.trim()) throw new ReleaseError("Release notes are required."); if (!(slot in SLOT_PORTS)) throw new ReleaseError("Slot must be blue or green.") }
function requireActor(actor) { if (!actor?.trim()) throw new ReleaseError("Release actor is required.") }
function composeProject(id) { return `scalesmiths-${id.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}` }
function assertHealth(raw, service, releaseId) { let data; try { data = JSON.parse(raw) } catch { throw new ReleaseError(`${service} returned invalid health JSON.`) } if (data.status !== "ok" || data.service !== service || (releaseId !== null && data.release !== releaseId)) throw new ReleaseError(`${service} health check did not confirm ${releaseId ? `release ${releaseId}` : "service readiness"}.`) }
function redactArg(arg) { return arg.toLowerCase().startsWith("x-health-check-token:") ? "x-health-check-token: [redacted]" : arg }
async function writeJsonAtomic(file, value) { const temporary = `${file}.tmp-${process.pid}`; await mkdir(path.dirname(file), { recursive: true }); await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8"); await rename(temporary, file) }
function runCommand(argv, options = {}) { const result = spawnSync(argv[0], argv.slice(1), { cwd: options.cwd, env: options.env, input: options.input, encoding: "utf8", stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"] }); if (result.status !== 0) throw new ReleaseError(`${argv[0]} failed (${result.status ?? "signal"}): ${(result.stderr || result.stdout || "no output").trim()}`); return result.stdout }

function parseArgs(argv) { const [command, ...rest] = argv; const options = {}; for (let index = 0; index < rest.length; index += 1) { const key = rest[index]; if (!key.startsWith("--")) throw new ReleaseError(`Unexpected argument ${key}.`); if (key === "--dry-run") { options.dryRun = true; continue } options[key.slice(2)] = rest[++index] } return { command, options } }
async function main() { const { command, options } = parseArgs(process.argv.slice(2)); const manager = new ReleaseManager({ root: options.root, repo: options.repo, upstreamPath: options["upstream-path"], dryRun: options.dryRun }); if (command === "prepare") await manager.prepare({ releaseId: options.release, actor: options.actor, notes: options.notes, slot: options.slot }); else if (command === "adopt") await manager.adopt({ releaseId: options.release, actor: options.actor, notes: options.notes, slot: options.slot }); else if (command === "switch") await manager.switch(options.release, options.actor); else if (command === "rollback") await manager.rollback(options.actor); else if (command === "status") console.log(JSON.stringify(await manager.loadState(), null, 2)); else throw new ReleaseError("Command must be adopt, prepare, switch, rollback, or status.") }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
