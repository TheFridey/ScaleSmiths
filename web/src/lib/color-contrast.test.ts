import { describe, expect, it } from "vitest"
import {
  contrastRatio,
  meetsWcagAa,
  meetsWcagAaUi,
  PUBLIC_CONTRAST_PAIRS,
  parseHexColor,
} from "./color-contrast"

describe("color-contrast", () => {
  it("parses hex colours", () => {
    expect(parseHexColor("#e8a045")).toEqual([232, 160, 69])
    expect(parseHexColor("#fff")).toEqual([255, 255, 255])
  })

  it("computes known contrast ratios", () => {
    // Nearly black on white is ~21:1
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0)
    // Forge gold CTA ink must clear AA on accent
    expect(contrastRatio("#1a1208", "#e8a045")).toBeGreaterThanOrEqual(4.5)
    // White on gold fails AA — the anti-pattern we eliminated
    expect(meetsWcagAa("#ffffff", "#e8a045")).toBe(false)
  })

  it("keeps every public token pair WCAG AA-safe", () => {
    for (const pair of PUBLIC_CONTRAST_PAIRS) {
      const ratio = contrastRatio(pair.fg, pair.bg)
      const ok = pair.largeText ? meetsWcagAaUi(pair.fg, pair.bg) : meetsWcagAa(pair.fg, pair.bg)
      expect(ok, `${pair.name} ratio ${ratio.toFixed(2)}`).toBe(true)
    }
  })
})
