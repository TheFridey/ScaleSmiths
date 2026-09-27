import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { DEFAULT_EXPERIENCE_VARIANT } from "./experience-experiment"

describe("homepage experience defaults", () => {
  it("defaults experiment config away from a forced fullscreen chooser", () => {
    expect(DEFAULT_EXPERIENCE_VARIANT).toBe("normal_with_interactive_cta")
  })

  it("renders the normal homepage without an experience gate", () => {
    const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8")
    expect(pageSource).toContain("HomePageContent")
    expect(pageSource).not.toContain("HomeExperienceGate")
  })

  it("keeps the interactive planner as a public secondary CTA destination", () => {
    const preferenceSource = readFileSync(new URL("../components/ExperiencePreference.tsx", import.meta.url), "utf8")
    expect(preferenceSource).toContain('PROJECT_PLANNER_HREF = "/interactive"')
    expect(preferenceSource).toContain('PROJECT_PLANNER_CTA_LABEL = "Launch the Project Planner"')
    expect(preferenceSource).toContain("export function ProjectPlannerCta")
    expect(preferenceSource).not.toContain("HomeExperienceGate")
    expect(preferenceSource).not.toContain("What experience would you like today?")
  })
})
