import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const mapping = readFileSync(new URL("../../../web/drizzle/0021_tenant_identity_mapping.sql", import.meta.url), "utf8")
const rls = readFileSync(new URL("../../../admin/drizzle/0060_tenant_rls_prototype.sql", import.meta.url), "utf8")
const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8")

describe("tenant RLS prototype artefacts", () => {
  it("maps existing portal text IDs onto integer client_record_id without replacing them", () => {
    expect(mapping).toContain('ALTER TABLE "client_requests" ADD COLUMN "client_record_id" integer')
    expect(mapping).toContain('ALTER TABLE "monthly_reports" ADD COLUMN "client_record_id" integer')
    expect(mapping).toContain("client.\"portal_client_id\" = request.\"client_id\"")
    expect(mapping).toContain("CREATE OR REPLACE FUNCTION app_fill_client_record_id()")
  })

  it("defines fail-closed tenant policies and a separate internal aggregate SELECT policy", () => {
    expect(rls).toContain("FORCE ROW LEVEL SECURITY")
    expect(rls).toContain("app_access_mode() = 'tenant'")
    expect(rls).toContain("FOR SELECT")
    expect(rls).toContain("app_is_internal_aggregate()")
    expect(rls).toContain("app_is_internal_write()")
    expect(rls).toContain("CREATE OR REPLACE FUNCTION app_forge_row_visible")
    expect(rls).not.toContain("USING (true)")
  })

  it("keeps admin runtime internal write distinct from tenant context and BYPASSRLS", () => {
    expect(db).toContain("internal_write")
    expect(db).toContain("TENANT_ACCESS_MODE.tenant")
    expect(db).toContain("withInternalAggregate")
    expect(db).not.toContain("BYPASSRLS")
  })
})
