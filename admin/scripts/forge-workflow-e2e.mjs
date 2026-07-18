import assert from "node:assert/strict"
import { readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { Client } from "pg"
import { adminDatabaseUrl } from "./database-url.mjs"

const baseUrl = process.env.FORGE_E2E_BASE_URL ?? "http://127.0.0.1:3301"
const email = process.env.ADMIN_EMAIL ?? "forge-e2e@scalesmiths.test"
const password = process.env.ADMIN_PASSWORD ?? "Forge-E2E-owner-2026!"
let cookie = ""
let stage = "startup"

try {
  await authenticate()
  const client = await call("client.create", "/api/clients", { name: "Oak & Hearth Property Care", contactName: "Alex Morgan", contactEmail: "alex@oakandhearth.test", tier: "growth" })
  const created = await call("project.create", "/api/forge/projects", { name: `Forge E2E ${Date.now()}`, businessName: "Oak & Hearth Property Care", clientId: client.clientId, industry: "Property maintenance", targetAudience: "Homeowners and landlords in Derbyshire", primaryGoal: "Generate qualified local repair enquiries" })
  const id = created.project.id
  await call("intake.start", `/api/forge/projects/${id}/intake`, { mode: "brief_start", prompt: "Oak & Hearth is a Derbyshire property maintenance business serving homeowners and landlords. Services include urgent repairs, planned maintenance, decorating and landlord reporting. The tone is calm, trustworthy and practical. The primary CTA is request a repair quote. Required pages are Home, Services, Landlord Maintenance, About and Contact." })
  await call("intake.complete", `/api/forge/projects/${id}/intake`, { mode: "brief_generate" })
  const research = await call("research.generate", `/api/forge/projects/${id}/research`, {})
  assert.ok(research.artifactId)
  await call("research.approve", `/api/forge/projects/${id}/research`, undefined, "PATCH")
  const sitemap = await call("sitemap.generate", `/api/forge/projects/${id}/sitemap`, {})
  assert.ok(sitemap.strategy?.sitemap?.length)
  const revisedStrategy = structuredClone(sitemap.strategy)
  revisedStrategy.sitemap[0].conversionNotes = `${revisedStrategy.sitemap[0].conversionNotes} Put local proof directly below the hero.`
  await call("sitemap.revise-and-approve", `/api/forge/projects/${id}/sitemap`, { strategy: revisedStrategy }, "PATCH")
  const copy = await call("copy.generate", `/api/forge/projects/${id}/copy`, {})
  const rejectedPath = copy.copy.pages[0].path
  await call("copy.reject", `/api/forge/projects/${id}/copy`, { action: "reject", pagePath: rejectedPath, reason: "The opening claim is too broad; make it specific to local repair response times." }, "PATCH")
  const regenerated = await call("copy.regenerate", `/api/forge/projects/${id}/copy`, { regeneratePagePath: rejectedPath })
  await call("copy.approve", `/api/forge/projects/${id}/copy`, { copy: regenerated.copy }, "PATCH")
  const design = await call("design.generate", `/api/forge/projects/${id}/design`, {})
  await call("design.approve", `/api/forge/projects/${id}/design`, { direction: design.direction, selectedStylePack: design.direction.selectedStylePack, selectedAnimationPack: design.direction.selectedAnimationPack }, "PATCH")
  const designSystem = await call("design-system.generate", `/api/forge/projects/${id}/design-system`, {})
  await call("design-system.approve", `/api/forge/projects/${id}/design-system`, { specification: designSystem.specification }, "PATCH")
  const components = await call("components.generate", `/api/forge/projects/${id}/component-spec`, {})
  await call("components.approve", `/api/forge/projects/${id}/component-spec`, { spec: components.spec }, "PATCH")
  const workspace = await call("workspace.create", `/api/forge/projects/${id}/workspace`, {})
  await call("site.generate", `/api/forge/projects/${id}/generate-site`, {})

  const workspaceRoot = path.resolve(process.cwd(), "..", workspace.workspace.relativePath)
  const siteDataFile = path.join(workspaceRoot, "src", "lib", "site-data.ts")
  const validSiteData = await readFile(siteDataFile, "utf8")
  const brokenSiteData = validSiteData.replace("trustElements: readonly string[]", "trustElements: string[]")
  assert.notEqual(brokenSiteData, validSiteData, "controlled QA fixture could not locate the repairable readonly declaration")
  await writeFile(siteDataFile, brokenSiteData)
  stage = "qa.controlled-failure"
  const failedQa = await callRaw(`/api/forge/projects/${id}/qa`, {})
  assert.equal(failedQa.status, 200, `controlled QA returned ${failedQa.status}: ${JSON.stringify(failedQa.body)}`)
  assert.equal(failedQa.body.report.status, "failed", "controlled type error must be persisted as a QA failure")
  await rm(path.join(workspaceRoot, "node_modules"), { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
  await rm(path.join(workspaceRoot, ".next"), { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
  const repaired = await call("qa.repair", `/api/forge/projects/${id}/qa`, { action: "repair" })
  assert.equal(repaired.report.status, "passed", `repair cycle must finish with passing QA: ${JSON.stringify(repaired.report.commands)}`)
  await call("proposal.generate", `/api/forge/projects/${id}/proposal`, {})

  const blocked = await callRaw(`/api/forge/projects/${id}/deploy`, { action: "mark_ready" })
  assert.ok(blocked.status >= 400, "deployment must remain blocked while required fallback approvals are absent")

  const db = new Client({ connectionString: adminDatabaseUrl() })
  await db.connect()
  try {
    const { rows: tasks } = await db.query("select id, project_id, status, result_quality, provider_attempted from forge_tasks where project_id=$1 order by id", [id])
    const fallback = tasks.filter((task) => task.result_quality === "fallback" || task.provider_attempted === "mock")
    assert.ok(fallback.length > 0, "deterministic provider tasks must be honestly marked fallback")
    for (const task of fallback) await call("quality.approve", `/api/forge/projects/${id}/tasks/${task.id}/quality-approval`, { reason: "E2E fixture explicitly approves deterministic fallback output after review." })
    const { rows: logs } = await db.query("select action, metadata_json from forge_activity_logs where project_id=$1", [id])
    for (const action of ["research_completed", "research_approved", "copy_rejected", "copy_approved", "design_system_version_saved", "design_system_approved", "workspace_created", "qa_failed", "repair_completed", "proposal_completed"]) assert.ok(logs.some((log) => log.action === action), `missing activity log: ${action}`)
    const { rows: artifacts } = await db.query("select id, type, version, output_hash, quality_state, approval_state from forge_artifacts where project_id=$1", [id])
    assert.ok(artifacts.length >= 7, "complete workflow must retain its artifacts")
    assert.ok(artifacts.filter((artifact) => artifact.type !== "handover_doc").every((artifact) => artifact.version && artifact.output_hash), "versioned artifacts must retain provenance hashes")
  } finally { await db.end() }
  console.log(`Forge E2E passed for project ${id}.`)
} catch (error) {
  console.error(`Forge E2E failed at stage '${stage}'.`)
  throw error
}

async function authenticate() {
  stage = "authenticate.csrf"
  const csrf = await callRaw("/api/auth/csrf")
  absorbCookies(csrf.response)
  assert.equal(csrf.status, 200)
  const form = new URLSearchParams({ csrfToken: csrf.body.csrfToken, email, password, callbackUrl: `${baseUrl}/forge` })
  stage = "authenticate.credentials"
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form, redirect: "manual" })
  absorbCookies(response)
  assert.ok([200, 302, 303].includes(response.status), `authentication returned ${response.status}`)
  assert.match(cookie, /authjs\.session-token|__Secure-authjs\.session-token/, "authentication did not issue a session cookie")
}

async function call(label, pathname, body, method = "POST") {
  stage = label
  const result = await callRaw(pathname, body, method)
  assert.ok(result.status >= 200 && result.status < 300, `${label} returned ${result.status}: ${JSON.stringify(result.body)}`)
  return result.body
}
async function callRaw(pathname, body, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), cookie }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" })
  absorbCookies(response)
  const text = await response.text()
  let parsed
  try { parsed = text ? JSON.parse(text) : {} } catch { parsed = { text: text.slice(0, 1000) } }
  return { status: response.status, body: parsed, response }
}
function absorbCookies(response) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean)
  const jar = new Map(cookie.split(/;\s*/).filter(Boolean).map((item) => item.split(/=(.*)/s).slice(0, 2)))
  for (const value of values) { const pair = value.split(";", 1)[0]; const index = pair.indexOf("="); if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1)) }
  cookie = [...jar].map(([key, value]) => `${key}=${value}`).join("; ")
}
