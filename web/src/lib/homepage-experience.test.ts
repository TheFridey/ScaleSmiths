import { describe, expect, it } from "vitest"
import { DEFAULT_EXPERIENCE_VARIANT } from "@/lib/experience-experiment"
import { PROJECT_PLANNER_CTA_LABEL, PROJECT_PLANNER_HREF } from "@/components/ExperiencePreference"

describe("homepage experience defaults", () => {
  it("defaults experiment config away from a forced fullscreen chooser", () => {
    expect(DEFAULT_EXPERIENCE_VARIANT).toBe("normal_with_interactive_cta")
  })

  it("keeps the interactive planner as a public secondary CTA destination", () => {
    expect(PROJECT_PLANNER_HREF).toBe("/interactive")
    expect(PROJECT_PLANNER_CTA_LABEL).toBe("Launch the Project Planner")
  })
})
