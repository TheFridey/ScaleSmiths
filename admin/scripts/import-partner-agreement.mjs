// Operation EMPOWER B2.10: imports the founder-supplied, solicitor-reviewed partner agreement as an UNPUBLISHED DRAFT, byte for byte.
//
//   AGREEMENT_IMPORT_DATABASE_URL=postgresql://…/<db> node scripts/import-partner-agreement.mjs \
//     --file=<path to the approved agreement .md> --title="<exact agreement title>" --legal-ref=legal:<review reference> \
//     --founder-email=<founder> [--slug=independent-partner-agreement] --confirm-import [--dry-run] [--allow-database=<db>]
//
// Why: pasting a long legal document into a text box can silently change it. This reads the supplied file exactly (UTF-8, line
// endings normalised to LF, nothing else altered), prints its SHA-256 fingerprint using the same formula as the database
// (partner_agreement_digest: title + "\n\n" + body), and stores it as a draft.
//
// Safety:
//  * Never submits, approves or publishes. Two founders review and publish in the Content Studio; the published fingerprint can be
//    compared with this run's output (and with scripts/agreement-fingerprint.mjs on the supplied file) before anyone accepts it.
//  * Generates no contractual wording: the body is the supplied file and nothing else.
//  * Refuses an input that is not a full agreement (under 200 characters), contains HTML, or lacks a legal: review reference.
//  * Disposable databases only unless --allow-database names the exact target (the founders' permission for a real environment).
//  * If a version of this agreement is already in progress, it is reported and nothing is written.
import { readFile } from "node:fs/promises"
import { createHash, randomUUID } from "node:crypto"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : true] }))
const dryRun = args["dry-run"] === true
const need = (name) => { if (typeof args[name] !== "string" || !args[name].trim()) throw new Error(`--${name} is required.`); return args[name].trim() }
const file = need("file"), title = need("title"), legalRef = need("legal-ref"), slug = typeof args.slug === "string" ? args.slug : "independent-partner-agreement"
if (!/^legal:\S{3,}$/.test(legalRef)) throw new Error("--legal-ref must start legal: and name the legal review (for example legal:solicitor-review-v4-1).")
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("--slug must be lowercase letters, numbers and hyphens.")
if (!args["confirm-import"] && !dryRun) throw new Error("Refusing to import without --confirm-import (or use --dry-run).")

const body = (await readFile(file, "utf8")).replace(/^﻿/, "").replace(/\r\n?/g, "\n")
if (body.trim().length < 200) throw new Error("The supplied file is too short to be a full agreement.")
if (/<\s*\/?\s*[a-z][^>]*>/i.test(body)) throw new Error("The supplied file contains HTML. Supply the agreement as Markdown or plain text.")
const agreementDigest = (t, b) => createHash("sha256").update(`${t}\n\n${b}`, "utf8").digest("hex")
const digest = agreementDigest(title, body)
console.log(`Agreement: ${title}\nFile: ${file}\nCharacters: ${body.length}\nFingerprint (SHA-256 of title + blank line + body): ${digest}`)
if (dryRun) { console.log("Dry run: nothing written."); process.exit(0) }

if (typeof args["founder-email"] !== "string") throw new Error("--founder-email=<active founder> is required.")
const raw = process.env.AGREEMENT_IMPORT_DATABASE_URL
if (!raw) throw new Error("AGREEMENT_IMPORT_DATABASE_URL is required; DATABASE_URL is deliberately not used.")
const url = new URL(raw), dbName = url.pathname.slice(1)
const disposable = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && /(test|e2e)/i.test(dbName)
if (!disposable && args["allow-database"] !== dbName) throw new Error(`Refusing to import into "${dbName}". Use a disposable test database, or pass --allow-database=${dbName} with the founders' permission.`)

const { Pool } = require("pg")
const pool = new Pool({ connectionString: raw, max: 1 })
const client = await pool.connect()
try {
  await client.query("begin")
  const founder = (await client.query("select id from admin_users where lower(email)=lower($1) and active=true and role::text in ('owner','administrator') for share", [args["founder-email"]])).rows[0]
  if (!founder) throw new Error("--founder-email must be an active owner or administrator.")
  const item = (await client.query("select id,kind from empower_content_items where slug=$1 for update", [slug])).rows[0]
  if (item && item.kind !== "agreement") throw new Error(`Slug ${slug} belongs to non-agreement content.`)
  let itemId = item?.id, version = 1
  if (item) {
    const open = (await client.query("select version,status from empower_content_versions where item_id=$1 and status in ('draft','in_review','approved')", [item.id])).rows[0]
    if (open) { await client.query("rollback"); console.log(`Nothing written: version ${open.version} of ${slug} is already ${open.status}. Finish or archive it first.`); process.exit(2) }
    version = Number((await client.query("select max(version) v from empower_content_versions where item_id=$1", [item.id])).rows[0].v) + 1
  } else {
    itemId = randomUUID()
    await client.query("insert into empower_content_items(id,kind,slug,audience,review_cadence_months,created_by) values($1,'agreement',$2,'partner_only',3,$3)", [itemId, slug, founder.id])
  }
  const versionId = randomUUID()
  await client.query("insert into empower_content_versions(id,item_id,version,title,body,fields,source_refs,change_summary,created_by) values($1,$2,$3,$4,$5,'{}'::jsonb,$6::jsonb,$7,$8)",
    [versionId, itemId, version, title, body, JSON.stringify([legalRef]), `Imported byte for byte from the supplied approved document; fingerprint ${digest}. Not approved or published.`, founder.id])
  const stored = (await client.query("select partner_agreement_digest(title, body) d from empower_content_versions where id=$1", [versionId])).rows[0].d
  if (stored !== digest) throw new Error("The stored text does not match the supplied file; nothing written.")
  await client.query("insert into expansion_audit(actor_id,entity_id,action,details) values($1,$2,'empower_agreement_imported',$3::jsonb)", [founder.id, itemId, JSON.stringify({ slug, version, sha256: digest, legalRef })])
  await client.query("commit")
  console.log(`Draft created: ${slug} version ${version}. Database fingerprint matches: ${stored}.\nNext: submit it in Founder workspace -> Content; a second founder approves; then publish.`)
} catch (error) { await client.query("rollback").catch(() => {}); throw error } finally { client.release(); await pool.end() }
