import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { validateDomainBoundaries } from "./check-domain-boundaries.mjs"

test("accepts the repository domain boundaries", () => {
  assert.deepEqual(validateDomainBoundaries(path.resolve(import.meta.dirname, "..")), [])
})

test("rejects UI storage access", () => {
  const root = fixture()
  const component = path.join(root, "admin/src/components/Unsafe.tsx")
  fs.mkdirSync(path.dirname(component), { recursive: true })
  fs.writeFileSync(component, 'import { db } from "@/lib/db"\n')
  assert.ok(validateDomainBoundaries(root).some((failure) => failure.includes("Unsafe.tsx is UI")))
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ss-domain-boundaries-"))
  for (const relative of [
    "admin/src/app/(protected)/dashboard/page.tsx", "admin/src/app/(protected)/clients/page.tsx",
    "web/src/app/portal/[clientId]/page.tsx", "web/src/app/portal/[clientId]/reports/[reportId]/page.tsx",
    "web/src/app/portal/[clientId]/requests/[requestId]/page.tsx",
    "admin/src/lib/server/acquisition-read-service.ts", "admin/src/lib/server/client-read-service.ts",
    "admin/src/lib/server/delivery-read-service.ts", "admin/src/lib/server/finance-read-service.ts",
    "admin/src/lib/server/reporting-read-service.ts",
    "admin/src/lib/server/sales-read-service.ts", "admin/src/lib/server/sales-lead-context.ts",
    "web/src/lib/portal-client-profile.ts", "web/src/lib/portal-client-requests.ts",
    "web/src/lib/portal-invoices.ts", "web/src/lib/portal-reports.ts",
  ]) {
    const file = path.join(root, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, relative.includes("/lib/") ? 'import "server-only"\n' : "export {}\n")
  }
  return root
}
