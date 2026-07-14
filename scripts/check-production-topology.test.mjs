import test from "node:test"
import assert from "node:assert/strict"
import { findTopologyViolations } from "./check-production-topology.mjs"

test("accepts the authoritative production topology and local development origins", () => {
  const files = [{
    path: "README.md",
    content: [
      "/var/www/scalesmiths/ScaleSmiths",
      'BACKUP_PRODUCTION_ROOT="${BACKUP_PRODUCTION_ROOT:-/var/www/scalesmiths/ScaleSmiths}"',
      "NEXT_PUBLIC_ADMIN_URL=https://admin.scalesmiths.co.uk",
      "AUTH_URL=http://localhost:3001",
      "generated-sites is relative to the Compose checkout",
    ].join("\n"),
  }]
  assert.deepEqual(findTopologyViolations(files), [])
})

test("reports every prohibited production topology form", () => {
  const files = [{
    path: "README.md",
    content: [
      "/srv/scalesmiths",
      "/var/www/scalesmiths",
      "https://scalesmiths.co.uk/admin",
      "NEXT_PUBLIC_ADMIN_URL=https://example.invalid",
      "@TheFridey/scalesmiths-maintainers",
    ].join("\n"),
  }]
  assert.deepEqual(
    new Set(findTopologyViolations(files).map((violation) => violation.rule)),
    new Set(["stale-production-root", "incomplete-production-root", "deprecated-admin-route", "noncanonical-admin-environment", "placeholder-codeowner"]),
  )
})

test("supports narrow rule-specific exceptions for historical evidence", () => {
  const files = [{ path: "docs/audits/legacy.md", content: "/srv/scalesmiths was the former root" }]
  const allowlist = { exceptions: { "docs/audits/legacy.md": ["stale-production-root"] } }
  assert.deepEqual(findTopologyViolations(files, allowlist), [])
})

test("rejects allowlisting an active runbook", () => {
  assert.throws(
    () => findTopologyViolations([], { exceptions: { "README.md": ["stale-production-root"] } }),
    /historical evidence or the test fixture/,
  )
})
