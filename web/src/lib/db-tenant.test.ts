import { describe, expect, it } from "vitest"
import { withPortalTenant } from "./db"

describe("portal tenant helper", () => {
  it("rejects a missing portal client id before opening a transaction", async () => {
    await expect(withPortalTenant("", async () => null)).rejects.toThrow("A portal client id is required.")
    await expect(withPortalTenant("   ", async () => null)).rejects.toThrow("A portal client id is required.")
  })
})
