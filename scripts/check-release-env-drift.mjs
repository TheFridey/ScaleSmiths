#!/usr/bin/env node
// Operation ASCEND B2.9: compare the protected canonical environment with a release environment for the switches that
// decide live recruitment, retention and automation behaviour. Prints key names and a verdict only, never a value.
//
// Usage: node scripts/check-release-env-drift.mjs <canonical .env> <release .env>
// Exit 0 when every governed switch is present and identical in both files; 1 otherwise; 2 on usage errors.
//
// Why: on 24 November 2026 the live release environment carried the approved B2.9 switches while the canonical checkout's
// .env did not. A release built or restarted from the canonical file would have silently switched recruitment and the
// ASCEND engine back to their code defaults. This check makes that drift a release blocker.
import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"
import { pathToFileURL } from "node:url"

/** Switches whose value is a founder decision. Secrets are deliberately excluded: they are compared by presence only. */
export const GOVERNED_SWITCHES = Object.freeze([
  "PARTNER_APPLICATIONS_ENABLED", "PARTNER_APPLICATION_PRIVACY_VERSION", "PARTNER_APPLICATION_RETENTION_DAYS", "PARTNER_RETENTION_EXECUTION_ENABLED",
  "EMPOWER_FOUNDER_CONTENT_ENABLED",
  "ASCEND_ENGINE_ENABLED", "ASCEND_SCHEDULER_ENABLED", "ASCEND_AGENT_API_ENABLED", "ASCEND_AUTOMATION_ENABLED",
  "MEGATON_ENABLED", "MEGATON_STOP", "MEGATON_EXTERNAL_ENABLED", "MEGATON_WORKER_SEND_ENABLED", "MEGATON_SEND_ENABLED", "MEGATON_SOCIAL_SEND_ENABLED",
  "MEGATON_NOTIFICATIONS_ENABLED", "MEGATON_MESSAGE_RETENTION_DAYS",
])

/** Returns one entry per governed switch: identical, differs, missing_in_canonical, missing_in_release or absent_in_both. */
export function compareEnvironments(canonicalText, releaseText, keys = GOVERNED_SWITCHES) {
  const canonical = parseEnv(canonicalText), release = parseEnv(releaseText)
  return keys.map((key) => {
    const inC = Object.hasOwn(canonical, key), inR = Object.hasOwn(release, key)
    const status = !inC && !inR ? "absent_in_both" : !inC ? "missing_in_canonical" : !inR ? "missing_in_release" : canonical[key] === release[key] ? "identical" : "differs"
    return { key, status }
  })
}

/** Absent in both is acceptable (code default applies equally); anything else is drift. */
export const isDrift = (entry) => entry.status !== "identical" && entry.status !== "absent_in_both"

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [canonicalPath, releasePath] = process.argv.slice(2)
  if (!canonicalPath || !releasePath) { console.error("Usage: node scripts/check-release-env-drift.mjs <canonical .env> <release .env>"); process.exit(2) }
  const result = compareEnvironments(readFileSync(canonicalPath, "utf8"), readFileSync(releasePath, "utf8"))
  for (const r of result) console.log(`${isDrift(r) ? "DRIFT" : "ok   "} ${r.key.padEnd(38)} ${r.status}`)
  const drift = result.filter(isDrift).length
  console.log(drift ? `\nBLOCKED: ${drift} governed switch(es) differ between the canonical and release environments (values not shown).` : "\nNo drift in governed switches.")
  process.exitCode = drift ? 1 : 0
}
