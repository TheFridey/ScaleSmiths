import { describe, expect, it } from "vitest"
import { withClientTenant } from "./db"

describe("admin tenant access helpers", () => {
  it("rejects a missing or non-positive tenant id before opening a transaction", async () => {
    await expect(withClientTenant(0, async () => null)).rejects.toThrow("A positive client tenant id is required.")
    await expect(withClientTenant(-4, async () => null)).rejects.toThrow("A positive client tenant id is required.")
    await expect(withClientTenant(1.5, async () => null)).rejects.toThrow("A positive client tenant id is required.")
  })
})
