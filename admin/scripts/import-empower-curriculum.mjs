// Operation Empower B1.2/B1.3: imports the planning-package curriculum and Resource Centre drafts as UNPUBLISHED DRAFTS.
//
//   EMPOWER_IMPORT_DATABASE_URL=postgresql://…/<db> node scripts/import-empower-curriculum.mjs --founder-email=<founder> --confirm-import [--dry-run] [--allow-database=<db>]
//
// Safety:
//  * Nothing is ever submitted, approved or published. Every row is a draft; approval needs a second founder in the studio.
//  * Founder-authorised: --founder-email must be an active owner or administrator, who becomes the author of every draft
//    (and therefore cannot approve them while another founder is active).
//  * Disposable databases only (loopback host, database name containing "test" or "e2e"), unless --allow-database names the
//    exact target database. Populating a real environment needs the founders' explicit permission; this flag records it.
//  * Idempotent and version-aware: unchanged items are skipped; changed items get a new draft version only when no version is
//    already in progress; items with a version in progress are reported, never overwritten. Every write is audited.
//  * Malformed or missing source content aborts the run before anything is written.
import { readFile, readdir } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { parsePackage, parseResource, parseKnowledgeBase, lessonSlug, courseSlug, cadenceFor, resourceSlug, knowledgeSlug } from "../src/lib/empower-curriculum.ts"
const require = createRequire(import.meta.url)
const { Pool } = require("pg")

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : true] }))
const dryRun = args["dry-run"] === true
if (!args["confirm-import"] && !dryRun) throw new Error("Refusing to import without --confirm-import (or use --dry-run).")
if (typeof args["founder-email"] !== "string") throw new Error("--founder-email=<active founder> is required.")
const raw = process.env.EMPOWER_IMPORT_DATABASE_URL
if (!raw) throw new Error("EMPOWER_IMPORT_DATABASE_URL is required; DATABASE_URL is deliberately not used.")
const url = new URL(raw), dbName = url.pathname.slice(1)
const disposable = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && /(test|e2e)/i.test(dbName)
if (!disposable && args["allow-database"] !== dbName) throw new Error(`Refusing to import into "${dbName}". Use a disposable test database, or pass --allow-database=${dbName} with the founders' permission to populate it.`)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "expansion", "empower")
const read = (f) => readFile(path.join(root, f), "utf8")
const pkg = parsePackage({ curriculum: await read("CURRICULUM.md"), foundations: await read("LESSONS-FOUNDATIONS.md"), practice: await read("LESSONS-PRACTICE.md"), checks: await read("KNOWLEDGE-CHECKS.md") })
const resourceFiles = (await readdir(path.join(root, "resources"))).filter((f) => /^R\d{2}-.+\.md$/.test(f)).sort()
if (resourceFiles.length !== 13) throw new Error(`Expected 13 resource drafts, found ${resourceFiles.length}.`)
const resources = []
for (const f of resourceFiles) { const parsed = parseResource(await read(`resources/${f}`), f, pkg.problems); if (parsed) resources.push(parsed) }
const knowledge = parseKnowledgeBase(await read("KNOWLEDGE-BASE.md"), { r08: await read("resources/R08-objection-handling-playbook.md"), r11: await read("resources/R11-commercial-pricing-reference.md") }, pkg.problems)
if (knowledge.length !== 32) pkg.problems.push(`Expected 32 knowledge entries, found ${knowledge.length}`)
if (pkg.problems.length) { console.error(JSON.stringify({ aborted: true, problems: pkg.problems }, null, 2)); process.exit(1) }

const pool = new Pool({ connectionString: raw, max: 1 })
const report = { database: dbName, dryRun, created: [], revised: [], unchanged: [], inProgress: [], problems: [] }
// jsonb does not preserve key order, so compare canonically.
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b))
try {
  const client = await pool.connect()
  try {
    await client.query("begin")
    const founder = (await client.query("select id,role::text role from admin_users where lower(email)=lower($1) and active=true and role::text in ('owner','administrator') for share", [args["founder-email"]])).rows[0]
    if (!founder) throw new Error("--founder-email is not an active owner or administrator.")
    const audit = (entity, action, details) => client.query("insert into expansion_audit(actor_id,entity_id,action,details) values($1,$2,$3,$4::jsonb)", [founder.id, entity, action, JSON.stringify({ ...details, source: "docs/expansion/empower", importer: "import-empower-curriculum" })])
    async function upsert({ slug, kind, cadence, title, body, fields, sources, summary, audience = "partner_only" }) {
      const item = (await client.query("select id from empower_content_items where slug=$1 for update", [slug])).rows[0]
      if (!item) {
        const itemId = randomUUID(), versionId = randomUUID()
        await client.query("insert into empower_content_items(id,kind,slug,audience,review_cadence_months,created_by) values($1,$2,$3,$4,$5,$6)", [itemId, kind, slug, audience, cadence === "commercial" ? 3 : 6, founder.id])
        await client.query("insert into empower_content_versions(id,item_id,version,title,body,fields,source_refs,change_summary,created_by) values($1,$2,1,$3,$4,$5::jsonb,$6::jsonb,$7,$8)", [versionId, itemId, title, body, JSON.stringify(fields), JSON.stringify(sources), summary, founder.id])
        await audit(itemId, "empower_imported", { slug, kind, version: 1 })
        report.created.push(slug); return itemId
      }
      const latest = (await client.query("select version,title,body,fields,source_refs from empower_content_versions where item_id=$1 order by version desc limit 1", [item.id])).rows[0]
      if (same([latest.title, latest.body, latest.fields, latest.source_refs], [title, body, fields, sources])) { report.unchanged.push(slug); return item.id }
      const open = (await client.query("select version,status from empower_content_versions where item_id=$1 and status in ('draft','in_review','approved')", [item.id])).rows[0]
      if (open) { report.inProgress.push(`${slug} (v${open.version} ${open.status})`); return item.id }
      const version = Number(latest.version) + 1
      await client.query("insert into empower_content_versions(id,item_id,version,title,body,fields,source_refs,change_summary,created_by) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)", [randomUUID(), item.id, version, title, body, JSON.stringify(fields), JSON.stringify(sources), `Re-imported from the planning package. ${summary}`.slice(0, 2000), founder.id])
      await audit(item.id, "empower_imported", { slug, kind, version })
      report.revised.push(`${slug} (v${version})`); return item.id
    }
    const lessonIds = {}
    for (const course of pkg.courses) for (const m of course.modules) for (const code of m.lessons) {
      const l = pkg.lessons[code]
      const fields = { course_code: l.courseCode, lesson_code: code, ...(pkg.checks[code] ? { checks: pkg.checks[code] } : {}) }
      lessonIds[code] = await upsert({ slug: lessonSlug(code), kind: "lesson", cadence: cadenceFor(l.courseCode), title: l.title, body: l.body, fields, sources: l.sources, summary: `Draft imported from ${l.sourceFile}; not approved.` })
    }
    for (const c of pkg.courses) {
      const fields = { category: c.category, objectives: c.objectives, modules: c.modules.map((m) => ({ title: m.title, lessons: m.lessons.map((code) => lessonIds[code]) })) }
      await upsert({ slug: courseSlug(c.code), kind: "course", cadence: c.cadence, title: c.title, body: c.description, fields, sources: [`docs/expansion/empower/CURRICULUM.md#${c.code.toLowerCase()}`],
        summary: `Draft imported from CURRICULUM.md; not approved. Founder review requirements: ${c.reviewNotes}` })
    }
    for (const res of resources) {
      await upsert({ slug: resourceSlug(res.code), kind: "resource", cadence: res.cadence, audience: res.audience, title: res.title, body: res.body, fields: { summary: res.summary, category: res.category }, sources: res.sources,
        summary: `Draft imported from resources/${res.file}; not approved.` })
    }
    for (const k of knowledge) {
      const fields = { question: k.question, answer: k.answer, client_explanation: k.clientExplanation, limitations: k.limitations, escalation_required: k.escalation.required, topic: k.topic,
        ...(k.escalation.condition ? { escalation_condition: k.escalation.condition } : {}), ...(k.escalation.route ? { escalation_route: k.escalation.route } : {}) }
      await upsert({ slug: knowledgeSlug(k.code), kind: "knowledge", cadence: k.cadence, audience: k.audience, title: k.question, body: "", fields, sources: k.sources, summary: "Draft imported from KNOWLEDGE-BASE.md; not approved." })
    }
    await client.query(dryRun ? "rollback" : "commit")
  } catch (error) { await client.query("rollback"); throw error } finally { client.release() }
} finally { await pool.end() }
report.totals = { created: report.created.length, revised: report.revised.length, unchanged: report.unchanged.length, inProgress: report.inProgress.length }
console.log(JSON.stringify(dryRun ? { ...report, note: "Dry run: everything was rolled back." } : report.totals, null, 2))
if (!dryRun) console.log("Imported as drafts only. Nothing was submitted, approved or published.")
