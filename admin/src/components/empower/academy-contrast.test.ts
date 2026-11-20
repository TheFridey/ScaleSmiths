import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/** WCAG 2.x contrast for the Academy palette, read from academy.css so the test fails if a token drifts. */
const css = readFileSync(path.join(__dirname, "academy.css"), "utf8")
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token --${name} not found`)
  return m[1]
}
const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) }
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe("Partner Academy colour contrast (WCAG AA, normal text 4.5:1)", () => {
  const surfaces = ["ac-bg", "ac-s1", "ac-s2", "ac-s3"]
  for (const text of ["ac-t1", "ac-t2", "ac-muted", "ac-gold"]) for (const surface of surfaces) {
    it(`${text} on ${surface}`, () => expect(ratio(token(text), token(surface))).toBeGreaterThanOrEqual(4.5))
  }
  it("button text on the gold button", () => expect(ratio("#131416", token("ac-gold"))).toBeGreaterThanOrEqual(4.5))
  it("does not use the failing admin muted colour", () => expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#667085/i))
})
