import { describe, expect, it } from "vitest"
import { getOnboardingTemplate, ONBOARDING_TEMPLATES, snapshotOnboardingTemplate } from "./delivery-onboarding-templates"

describe("delivery onboarding templates", () => {
  it("uses unique stable key and version pairs", () => {
    const identities = ONBOARDING_TEMPLATES.map(({ key, version }) => `${key}@${version}`)
    expect(new Set(identities).size).toBe(identities.length)
    expect(ONBOARDING_TEMPLATES.every(({ version }) => Number.isInteger(version) && version > 0)).toBe(true)
  })

  it("keeps every item and deliverable attached to a declared milestone", () => {
    for (const template of ONBOARDING_TEMPLATES) {
      const refs = new Set(template.milestones.map(({ ref }) => ref))
      expect(template.items.every(({ milestoneRef }) => refs.has(milestoneRef))).toBe(true)
      expect(template.deliverables.every(({ milestoneRef }) => refs.has(milestoneRef))).toBe(true)
    }
  })

  it("returns a detached snapshot for project instantiation", () => {
    const template = getOnboardingTemplate("website-build")!
    const snapshot = snapshotOnboardingTemplate(template)
    snapshot.milestones[0].title = "Adjusted discovery"
    expect(template.milestones[0].title).toBe("Discovery")
  })
})
