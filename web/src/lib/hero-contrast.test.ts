import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("homepage hero contrast and motion", () => {
  const heroSource = readFileSync(new URL("../components/Hero.tsx", import.meta.url), "utf8")
  const videoSource = readFileSync(new URL("../components/HeroForgeVideo.tsx", import.meta.url), "utf8")
  const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

  it("keeps a local text scrim behind hero brand and headline copy", () => {
    expect(heroSource).toContain("data-hero-text-scrim")
    expect(heroSource).toContain("hero-text-scrim")
    expect(heroSource).toContain("hero-copy")
    expect(cssSource).toContain(".hero-text-scrim")
    expect(cssSource).toContain(".hero-copy")
    expect(cssSource).toMatch(/text-shadow:/)
  })

  it("hides the forge video when reduced motion is preferred", () => {
    expect(videoSource).toContain("useReducedMotion")
    expect(videoSource).toContain("if (reducedMotion) return null")
    expect(cssSource).toContain("@media (prefers-reduced-motion: reduce)")
    expect(cssSource).toContain(".hero-forge-video { display: none !important; }")
  })
})
