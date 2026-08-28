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

  async prepare({ releaseId, actor, notes, slot, retryOfAttemptId = null }) {
    validateReleaseInput({ releaseId, actor, notes, slot })
    const recordPath = this.recordPath(releaseId)
    let attemptNumber = 1
    if (existsSync(recordPath)) {
      const previousAttempt = await this.loadRecord(releaseId)
      if (!retryOfAttemptId || retryOfAttemptId !== previousAttempt.attemptId || !["failed", "cancelled"].includes(previousAttempt.status)) throw new ReleaseError(`Release ${releaseId} already exists; retry a failed or cancelled attempt by its attempt ID.`)
      attemptNumber = Number(previousAttempt.attemptId.split(":").at(-1)) + 1
      await this.action("archive previous release attempt", () => writeJsonAtomic(this.attemptPath(previousAttempt.attemptId), previousAttempt))
    }
    const ports = SLOT_PORTS[slot]
    const sourceCommit = this.env.GIT_COMMIT_SHA ?? this.env.ERROR_MONITORING_RELEASE ?? null
    const release = { releaseId, deploymentId: releaseId, attemptId: `${releaseId}:${attemptNumber}`, retryOfAttemptId, actor, notes, project: "scalesmiths", environment: this.env.SS_RELEASE_ENVIRONMENT ?? "production", sourceCommit, artifact: { webImage: `scalesmiths-web:${releaseId}`, adminImage: `scalesmiths-admin:${releaseId}` }, slot, ports, status: "preparing", outcome: null, failureCategory: null, safeErrorSummary: null, gateOutcomes: [], rollback: { attempted: false, outcome: "not_attempted", targetVersion: null }, previousVersion: (await this.loadState()).activeReleaseId ?? null, resultingActiveVersion: null, createdAt: this.now().toISOString(), startedAt: this.now().toISOString(), endedAt: null, readyAt: null, switchedAt: null }
    await this.action(`create release record ${recordPath}`, async () => { await mkdir(path.dirname(recordPath), { recursive: true }); await writeJsonAtomic(recordPath, release) })
    const env = this.releaseEnvironment(release)
    let failureStage = "compose_validation"
    try {
      await this.runGate(release, "compose_validation", "preflight", () => this.command("validate Compose configuration", ["docker", "compose", "-f", "docker-compose.release.yml", "config", "--quiet"], env))
      failureStage = "web_image_build"
      await this.persistProgress(release, failureStage)
      await this.command("build versioned web image", dockerBuildCommand("web", releaseId, env), env)
      failureStage = "admin_image_build"
      await this.persistProgress(release, failureStage)
      await this.command("build versioned admin image", dockerBuildCommand("admin", releaseId, env), env)
      failureStage = "inactive_slot_start"
      await this.persistProgress(release, failureStage)
      await this.command("start inactive release containers", ["docker", "compose", "-p", composeProject(releaseId), "-f", "docker-compose.release.yml", "up", "-d", "--no-build", "web", "admin"], env)
      failureStage = "inactive_health_check"
      await this.runGate(release, "inactive_health_check", "health_check", () => this.healthCheck(release))
      release.status = "ready"; release.readyAt = this.now().toISOString()
      await this.action(`mark release ${releaseId} ready`, () => writeJsonAtomic(recordPath, release))
      await this.log("release_prepared", release, { healthVerified: true })
      return release
    } catch (error) {
      this.failRelease(release, failureStage)
      await this.recordFailure("release_prepare_failed", release, actor, failureStage)
      throw error
    }
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
    let failureStage = "pre_switch_health_check"
    try {
      await this.runGate(release, "pre_switch_health_check", "health_check", () => this.healthCheck(release))
      const state = await this.loadState()
      if (state.activeReleaseId === releaseId) throw new ReleaseError(`Release ${releaseId} is already active.`)
      failureStage = "nginx_switch"
      await this.persistProgress(release, failureStage)
      await this.installUpstreams(release)
      const nextState = { activeReleaseId: releaseId, previousReleaseId: state.activeReleaseId ?? null, switchedAt: this.now().toISOString(), actor }
      release.status = "active"; release.switchedAt = nextState.switchedAt
      failureStage = "release_state_persistence"
      await this.action("persist active/previous release state", async () => { await writeJsonAtomic(this.statePath(), nextState); await writeJsonAtomic(this.recordPath(releaseId), release) })
      failureStage = "post_switch_health_check"
      await this.runGate(release, "post_switch_health_check", "health_check", () => this.healthCheck(release))
      failureStage = "public_health_check"
      if (this.env.SS_PUBLIC_HEALTH_URL) await this.runGate(release, "public_health_check", "health_check", () => this.command("verify public web health", ["curl", "--fail", "--silent", "--show-error", "--max-time", "15", this.env.SS_PUBLIC_HEALTH_URL]))
      release.outcome = "succeeded"; release.endedAt = this.now().toISOString(); release.resultingActiveVersion = releaseId
      await this.action(`finalise release ${releaseId}`, () => writeJsonAtomic(this.recordPath(releaseId), release))
      await this.log("release_switched", release, { actor, previousReleaseId: nextState.previousReleaseId, postReleaseVerified: true })
      return nextState
    } catch (error) {
      this.failRelease(release, failureStage)
      await this.recordFailure("release_switch_failed", release, actor, failureStage)
      throw error
    }
  }

  async rollback(actor) {
    requireActor(actor)
    const state = await this.loadState()
    if (!state.previousReleaseId) throw new ReleaseError("No retained previous release is available for rollback.")
    const target = await this.loadReady(state.previousReleaseId, true)
    const current = state.activeReleaseId ? await this.loadRecord(state.activeReleaseId) : target
    current.rollback = { attempted: true, outcome: "running", targetVersion: target.releaseId, startedAt: this.now().toISOString(), endedAt: null }
    await this.action("persist rollback start", () => writeJsonAtomic(this.recordPath(current.releaseId), current))
    let failureStage = "rollback_target_health_check"
    try {
      await this.runGate(current, failureStage, "health_check", () => this.healthCheck(target))
      failureStage = "rollback_traffic_switch"; await this.persistProgress(current, failureStage); await this.installUpstreams(target)
      const next = { activeReleaseId: target.releaseId, previousReleaseId: state.activeReleaseId, switchedAt: this.now().toISOString(), actor }
      failureStage = "rollback_state_persistence"
      await this.action("persist rollback state", async () => { await writeJsonAtomic(this.statePath(), next) })
      failureStage = "rollback_health_check"
      await this.runGate(current, failureStage, "health_check", () => this.healthCheck(target))
      current.rollback = { ...current.rollback, outcome: "succeeded", endedAt: this.now().toISOString() }; current.status = "rolled_back"; current.outcome = "rolled_back"; current.endedAt = current.rollback.endedAt; current.resultingActiveVersion = target.releaseId
      await this.action("persist rollback result", () => writeJsonAtomic(this.recordPath(current.releaseId), current))
      await this.log("release_rolled_back", current, { actor, replacedReleaseId: state.activeReleaseId, targetReleaseId: target.releaseId, rollbackOutcome: "succeeded", postReleaseVerified: true })
      return next
    } catch (error) {
      current.rollback = { ...current.rollback, outcome: "failed", endedAt: this.now().toISOString() }; current.status = "rollback_failed"; current.outcome = "failed"; current.endedAt = current.rollback.endedAt; current.failureCategory = "rollback"; current.failureStage = failureStage; current.safeErrorSummary = safeFailureSummary(failureStage)
      await this.recordFailure("release_rollback_failed", current, actor, failureStage)
      throw error
    }
  }

  async cancel(releaseId, actor, reason) {
    requireActor(actor); if (!reason?.trim()) throw new ReleaseError("Cancellation reason is required.")
    const release = await this.loadRecord(releaseId)
    if (!["preparing", "ready"].includes(release.status)) throw new ReleaseError(`Release ${releaseId} cannot be cancelled from ${release.status}.`)
    release.status = "cancelled"; release.outcome = "cancelled"; release.endedAt = this.now().toISOString(); release.cancelledAt = release.endedAt; release.failureCategory = "cancelled"; release.safeErrorSummary = "Release cancelled by an authorised operator."
    await this.action("persist cancelled release", () => writeJsonAtomic(this.recordPath(releaseId), release))
    await this.log("release_cancelled", release, { actor, reason: boundedSafeText(reason) })
    return release
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
  async recordFailure(event, release, actor, failureStage) {
    try {
      await this.action(`record ${event}`, async () => {
        await writeJsonAtomic(this.recordPath(release.releaseId), release)
        await this.log(event, release, { actor, failureStage, failureCategory: release.failureCategory, safeErrorSummary: release.safeErrorSummary, rollbackOutcome: release.rollback?.outcome })
      })
    } catch {}
  }
  recordPath(id) { return path.join(this.root, "releases", `${id}.json`) }
  attemptPath(id) { return path.join(this.root, "attempts", `${id.replace(":", "-")}.json`) }
  statePath() { return path.join(this.root, "state.json") }
  async loadState() { return existsSync(this.statePath()) ? JSON.parse(await readFile(this.statePath(), "utf8")) : {} }
  async loadRecord(id) { if (!RELEASE_ID.test(id) || !existsSync(this.recordPath(id))) throw new ReleaseError(`Release ${id} is not prepared.`); return JSON.parse(await readFile(this.recordPath(id), "utf8")) }
  async loadReady(id, allowActive = false) { if (!RELEASE_ID.test(id)) throw new ReleaseError("Invalid release ID."); if (!existsSync(this.recordPath(id))) throw new ReleaseError(`Release ${id} is not prepared.`); const release = JSON.parse(await readFile(this.recordPath(id), "utf8")); if (release.status !== "ready" && !(allowActive && ["active", "rolled_back"].includes(release.status))) throw new ReleaseError(`Release ${id} is not a verified ready release.`); return release }
  async log(event, release, detail) { await this.action(`append deployment log ${event}`, async () => { await mkdir(this.root, { recursive: true }); await writeFile(path.join(this.root, "deployments.jsonl"), `${JSON.stringify({ event, releaseId: release.releaseId, actor: detail.actor ?? release.actor, timestamp: this.now().toISOString(), notes: release.notes, ...detail })}\n`, { flag: "a" }) }) }
  async persistProgress(release, stage) { release.currentStage = stage; await this.action(`persist release stage ${stage}`, () => writeJsonAtomic(this.recordPath(release.releaseId), release)) }
  async runGate(release, key, category, fn) { const gate = { key, category, status: "running", startedAt: this.now().toISOString(), endedAt: null }; release.gateOutcomes.push(gate); await this.persistProgress(release, key); try { const value = await fn(); gate.status = "passed"; gate.endedAt = this.now().toISOString(); await this.persistProgress(release, key); return value } catch (error) { gate.status = "failed"; gate.endedAt = this.now().toISOString(); await this.persistProgress(release, key); throw error } }
  failRelease(release, stage) { release.status = "failed"; release.outcome = "failed"; release.failedAt = this.now().toISOString(); release.endedAt = release.failedAt; release.failureStage = stage; release.failureCategory = failureCategory(stage); release.safeErrorSummary = safeFailureSummary(stage) }
}

export function renderUpstreams(ports) { return `# Managed atomically by ScaleSmiths release manager.\nupstream scalesmiths_web {\n  server 127.0.0.1:${ports.web};\n  keepalive 16;\n}\n\nupstream scalesmiths_admin {\n  server 127.0.0.1:${ports.admin};\n  keepalive 16;\n}\n` }
function validateReleaseInput({ releaseId, actor, notes, slot }) { if (!RELEASE_ID.test(releaseId)) throw new ReleaseError("Release ID must contain only letters, numbers, dot, underscore or hyphen."); if (!actor?.trim()) throw new ReleaseError("Release actor is required."); if (!notes?.trim()) throw new ReleaseError("Release notes are required."); if (!(slot in SLOT_PORTS)) throw new ReleaseError("Slot must be blue or green.") }
function requireActor(actor) { if (!actor?.trim()) throw new ReleaseError("Release actor is required.") }
function failureCategory(stage) { if (stage.includes("health_check")) return "health_check"; if (stage.startsWith("rollback")) return "rollback"; if (stage === "compose_validation") return "preflight"; return "deployment" }
function safeFailureSummary(stage) { const labels = { compose_validation: "Release preflight validation failed.", web_image_build: "Web image build failed.", admin_image_build: "Admin image build failed.", inactive_slot_start: "Inactive release containers failed to start.", inactive_health_check: "Inactive release health verification failed.", pre_switch_health_check: "Pre-switch health verification failed.", nginx_switch: "Traffic switch failed; the previous upstream was restored where possible.", release_state_persistence: "Traffic changed but release state could not be persisted; investigate immediately.", post_switch_health_check: "Post-switch health verification failed.", public_health_check: "Public health verification failed.", rollback_target_health_check: "Rollback target health verification failed.", rollback_traffic_switch: "Rollback traffic switch failed.", rollback_state_persistence: "Rollback traffic changed but state persistence failed; investigate immediately.", rollback_health_check: "Rollback completed but health verification failed." }; return labels[stage] ?? "Release operation failed." }
function boundedSafeText(value) { return String(value).replace(/[\r\n\t]+/g, " ").replace(/(token|secret|password|key)\s*[=:]\s*\S+/gi, "$1=[redacted]").slice(0, 500) }
function composeProject(id) { return `scalesmiths-${id.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}` }
function dockerBuildCommand(app, releaseId, env) {
  const args = ["docker", "build", "--pull", "-t", `scalesmiths-${app}:${releaseId}`]
  if (env.ERROR_MONITORING_RELEASE) args.push("--build-arg", `ERROR_MONITORING_RELEASE=${env.ERROR_MONITORING_RELEASE}`)
  if (env.SENTRY_ORG) args.push("--build-arg", `SENTRY_ORG=${env.SENTRY_ORG}`)
  const projectKey = app === "web" ? "SENTRY_WEB_PROJECT" : "SENTRY_ADMIN_PROJECT"
  if (env[projectKey]) args.push("--build-arg", `${projectKey}=${env[projectKey]}`)
  if (env.SENTRY_AUTH_TOKEN) args.push("--secret", "id=sentry_auth_token,env=SENTRY_AUTH_TOKEN")
  return [...args, app]
}
function assertHealth(raw, service, releaseId) { let data; try { data = JSON.parse(raw) } catch { throw new ReleaseError(`${service} returned invalid health JSON.`) } if (data.status !== "ok" || data.service !== service || (releaseId !== null && data.release !== releaseId)) throw new ReleaseError(`${service} health check did not confirm ${releaseId ? `release ${releaseId}` : "service readiness"}.`) }
function redactArg(arg) { return arg.toLowerCase().startsWith("x-health-check-token:") ? "x-health-check-token: [redacted]" : arg }
async function writeJsonAtomic(file, value) { const temporary = `${file}.tmp-${process.pid}`; await mkdir(path.dirname(file), { recursive: true }); await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8"); await rename(temporary, file) }
function runCommand(argv, options = {}) { const result = spawnSync(argv[0], argv.slice(1), { cwd: options.cwd, env: options.env, input: options.input, encoding: "utf8", stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"] }); if (result.status !== 0) throw new ReleaseError(`${argv[0]} failed (${result.status ?? "signal"}): ${(result.stderr || result.stdout || "no output").trim()}`); return result.stdout }

function parseArgs(argv) { const [command, ...rest] = argv; const options = {}; for (let index = 0; index < rest.length; index += 1) { const key = rest[index]; if (!key.startsWith("--")) throw new ReleaseError(`Unexpected argument ${key}.`); if (key === "--dry-run") { options.dryRun = true; continue } options[key.slice(2)] = rest[++index] } return { command, options } }
async function main() { const { command, options } = parseArgs(process.argv.slice(2)); const manager = new ReleaseManager({ root: options.root, repo: options.repo, upstreamPath: options["upstream-path"], dryRun: options.dryRun }); if (command === "prepare") await manager.prepare({ releaseId: options.release, actor: options.actor, notes: options.notes, slot: options.slot, retryOfAttemptId: options["retry-of"] ?? null }); else if (command === "adopt") await manager.adopt({ releaseId: options.release, actor: options.actor, notes: options.notes, slot: options.slot }); else if (command === "switch") await manager.switch(options.release, options.actor); else if (command === "rollback") await manager.rollback(options.actor); else if (command === "cancel") await manager.cancel(options.release, options.actor, options.reason); else if (command === "status") console.log(JSON.stringify(await manager.loadState(), null, 2)); else throw new ReleaseError("Command must be adopt, prepare, switch, rollback, cancel, or status.") }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
