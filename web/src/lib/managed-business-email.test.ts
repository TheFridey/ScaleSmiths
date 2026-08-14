import { describe, expect, it } from "vitest"
import { buildManagedBusinessEmailSchema, managedBusinessEmail, managedBusinessEmailPriceLabel } from "./managed-business-email"

describe("Managed Business Email commercial source of truth", () => {
  it("keeps the confirmed standalone offer together", () => {
    expect(managedBusinessEmailPriceLabel()).toBe("£15")
    expect(managedBusinessEmail.standalone).toMatchObject({ mailboxes: 3, storagePerMailboxGb: 5, setupIncluded: true })
    expect(managedBusinessEmail.standalone.billingCadence).toBeNull()
  })

  it("emits visible FAQ and service schema without exposing infrastructure", () => {
    const serialised = JSON.stringify(buildManagedBusinessEmailSchema())
    expect(serialised).toContain("FAQPage")
    expect(serialised).toContain("Service")
    expect(serialised).toContain("three mailboxes")
    expect(serialised).not.toMatch(/mailcow|sogo|internal hostname|smtp topology/i)
  })
})
