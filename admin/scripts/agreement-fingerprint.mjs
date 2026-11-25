// Operation EMPOWER B2.10: prints the fingerprint of a supplied agreement file exactly as the database computes it
// (partner_agreement_digest: SHA-256 of title + "\n\n" + body, UTF-8, line endings normalised to LF). No database access.
//
//   node scripts/agreement-fingerprint.mjs --file=<agreement.md> --title="<exact title>"
//
// Compare the output with the fingerprint shown on the published agreement (activation page, agreement page and every acceptance
// record). A difference means the published text is not the supplied document.
import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : true] }))
if (typeof args.file !== "string" || typeof args.title !== "string") { console.error('Usage: node scripts/agreement-fingerprint.mjs --file=<agreement.md> --title="<exact title>"'); process.exit(2) }
const body = (await readFile(args.file, "utf8")).replace(/^﻿/, "").replace(/\r\n?/g, "\n")
console.log(createHash("sha256").update(`${args.title.trim()}\n\n${body}`, "utf8").digest("hex"))
