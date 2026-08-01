import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8")

describe("dashboard MRR chart contract", () => {
  it("keeps responsive, tooltip and accessible Recharts behaviour", () => {
    expect(source).toContain('<ResponsiveContainer width="100%" height={148}>')
    expect(source).toContain("<Tooltip")
    expect(source).toContain("accessibilityLayer")
    expect(source).toContain('aria-label="Monthly recurring revenue by client tier"')
  })

  it("renders an explicit empty state instead of a blank chart", () => {
    expect(source).toContain("No recurring revenue data yet.")
  })
})
