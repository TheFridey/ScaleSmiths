import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const economics = readFileSync(new URL("./forge-economics.ts", import.meta.url), "utf8")
const clients = readFileSync(new URL("./client-read-service.ts", import.meta.url), "utf8")
const sales = readFileSync(new URL("./sales-read-service.ts", import.meta.url), "utf8")

describe("Forge economics cross-domain reads", () => {
  it("uses batch domain APIs without knowing client or sales tables", () => {
    expect(economics).toContain("getClientNamesByIds(clientIds)")
    expect(economics).toContain("getForgeProposalEconomics(filters.clientId)")
    expect(economics).not.toMatch(/import \{[^}]*\b(?:clients|salesProposals)\b[^}]*\} from "@\/lib\/schema"/)
  })

  it("avoids N+1 client lookups and aggregates Forge proposal value in SQL", () => {
    expect(clients).toContain("inArray(clients.id, uniqueIds)")
    expect(sales).toContain("count(*)::int")
    expect(sales).toContain("sum(${salesProposals.buildPrice})")
    expect(sales).toContain('eq(salesProposals.generatedBy, "forge")')
  })
})
