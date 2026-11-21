import { describe, expect, it } from "vitest"
import { ACHIEVEMENTS, BESPOKE_EXAMPLES_PENCE, bespokeCommission, cumulativeAchievementCash, minimumContractValuePence, partnerLoginUrl, saleCommission, standardSalesCommission } from "./partner-programme"

const gbp = (p: bigint) => Number(p / BigInt(100))
describe("Scale Your Future calculations", () => {
  it("standard sale is £705 on a £6,200 minimum contract", () => {
    expect(gbp(saleCommission("standard").total)).toBe(705)
    expect(gbp(minimumContractValuePence())).toBe(6200)
  })
  it("matches every required sales-volume example", () => {
    const expected: Record<number, number> = { 1: 705, 2: 1410, 4: 2820, 5: 3525, 8: 5640, 10: 7050, 15: 10575, 20: 14100 }
    for (const [n, v] of Object.entries(expected)) expect(gbp(standardSalesCommission(Number(n)))).toBe(v)
  })
  it("discounted, free-build and retainer-only outcomes", () => {
    expect([150000, 100000, 50000].map((f) => gbp(saleCommission("discounted", BigInt(f)).total))).toEqual([555, 405, 255])
    expect(gbp(saleCommission("free-build").total)).toBe(105)
    expect(gbp(saleCommission("retainer-only").total)).toBe(105)
    expect(gbp(minimumContractValuePence(BigInt(0)))).toBe(4200)
    expect(() => saleCommission("discounted", BigInt(250000))).toThrow()
  })
  it("bespoke examples are 30% of eligible collected value", () => {
    expect(BESPOKE_EXAMPLES_PENCE.map((v) => gbp(bespokeCommission(v)))).toEqual([1500, 3000, 7500, 15000, 30000, 75000])
  })
  it("achievement cash is conditional and cumulative totals match the schedule", () => {
    expect(gbp(cumulativeAchievementCash(100))).toBe(8000)
    expect(gbp(cumulativeAchievementCash(250))).toBe(23000)
    expect(gbp(cumulativeAchievementCash(500))).toBe(53000)
    expect(ACHIEVEMENTS).toHaveLength(8)
  })
  it("partner login reuses the admin origin and rejects credentials", () => {
    expect(partnerLoginUrl({ NODE_ENV: "production" })).toBe("https://partners.scalesmiths.co.uk/login")
    expect(partnerLoginUrl({ NODE_ENV: "development" })).toBe("http://localhost:3103/login")
    expect(partnerLoginUrl({ NEXT_PUBLIC_ADMIN_URL: "https://admin.example.test/", NODE_ENV: "production" })).toBe("https://admin.example.test/login")
    expect(partnerLoginUrl({ NEXT_PUBLIC_ADMIN_URL: "https://u:p@evil.test", NODE_ENV: "production" })).toBe("https://partners.scalesmiths.co.uk/login")
  })
})
