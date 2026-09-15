import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { teamImages } from "./team-images"

const publicDir = join(__dirname, "..", "..", "public")

describe("founder photography manifest", () => {
  it("only marks a photo available when the real asset exists on disk", () => {
    for (const [key, image] of Object.entries(teamImages)) {
      expect(existsSync(join(publicDir, image.src)), `${key}: available flag must match ${image.src}`).toBe(image.available)
    }
  })

  it("serves team photography as WebP from the team image directory", () => {
    for (const image of Object.values(teamImages)) {
      expect(image.src).toMatch(/^\/images\/team\/[a-z0-9-]+\.webp$/)
    }
  })

  it("describes each photo naturally without keyword stuffing", () => {
    for (const image of Object.values(teamImages)) {
      expect(image.alt).toMatch(/ScaleSmiths/)
      expect(image.alt.length).toBeLessThanOrEqual(125)
      expect(image.alt).not.toMatch(/\b(?:seo|agency|best|near me)\b/i)
    }
  })
})
