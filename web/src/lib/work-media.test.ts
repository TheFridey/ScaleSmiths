import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"
import { projects } from "./data"
import { availableWorkMedia } from "./work-media-manifest"
import { projectMediaPlans } from "./work-media"

const publicDir = join(__dirname, "..", "..", "public")

function imagesOnDisk(dir = join(publicDir, "images", "work")): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return imagesOnDisk(path)
    return /\.(?:webp|avif|png|jpe?g)$/i.test(entry) ? [`/${relative(publicDir, path).split(sep).join("/")}`] : []
  }).sort()
}

const allShots = Object.values(projectMediaPlans).flatMap((media) => media.shots)

describe("case-study media manifest", () => {
  it("matches the screenshots actually on disk (run `npm run work-media:sync`)", () => {
    expect([...availableWorkMedia].sort()).toEqual(imagesOnDisk())
  })

  it("only contains files a case study plans to show, so no capture is silently ignored", () => {
    const planned = new Set(allShots.map((shot) => shot.src))
    for (const file of availableWorkMedia) expect(planned.has(file), `${file} is not in projectMediaPlans`).toBe(true)
  })

  it("marks a shot available exactly when its file is in the manifest", () => {
    const manifest = new Set(availableWorkMedia)
    for (const shot of allShots) expect(shot.available).toBe(manifest.has(shot.src))
  })
})

describe("case-study media plans", () => {
  it("follows the documented naming convention", () => {
    for (const shot of allShots) {
      expect(shot.src).toMatch(/^\/images\/work\/[a-z0-9-]+\/(?:before-)?[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/)
      if (shot.stage === "before") expect(shot.src).toMatch(/\/before-(?:desktop|tablet|mobile)-/)
    }
  })

  it("plans imagery for every published case study with a homepage capture", () => {
    for (const project of projects) {
      const media = projectMediaPlans[project.slug]
      expect(media, `${project.slug} has no media plan`).toBeDefined()
      expect(media.shots.some((shot) => shot.section === "homepage" && shot.view === "desktop" && shot.stage === "current")).toBe(true)
    }
  })

  it("keeps file names unique and alt text natural", () => {
    expect(new Set(allShots.map((shot) => shot.src)).size).toBe(allShots.length)
    for (const shot of allShots) {
      expect(shot.alt).toMatch(/ScaleSmiths/)
      expect(shot.alt.length).toBeLessThanOrEqual(140)
      expect(shot.alt).not.toMatch(/\b(?:seo|agency|best|near me)\b/i)
    }
  })
})
