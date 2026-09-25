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
    expect(parseHexColor("#22d3ee")).toEqual([34, 211, 238])
    expect(parseHexColor("#fff")).toEqual([255, 255, 255])
  })

  it("computes known contrast ratios", () => {
    // Nearly black on white is ~21:1
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0)
    // Cyan CTA ink must clear AA on accent
    expect(contrastRatio("#04131c", "#22d3ee")).toBeGreaterThanOrEqual(4.5)
    // White on cyan fails AA — the anti-pattern we eliminated
    expect(meetsWcagAa("#ffffff", "#22d3ee")).toBe(false)
  })

  it("keeps every public token pair WCAG AA-safe", () => {
    for (const pair of PUBLIC_CONTRAST_PAIRS) {
      const ratio = contrastRatio(pair.fg, pair.bg)
      const ok = pair.largeText ? meetsWcagAaUi(pair.fg, pair.bg) : meetsWcagAa(pair.fg, pair.bg)
      expect(ok, `${pair.name} ratio ${ratio.toFixed(2)}`).toBe(true)
    }
  })
})
