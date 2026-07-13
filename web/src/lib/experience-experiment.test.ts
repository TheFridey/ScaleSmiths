import { describe, expect, it } from "vitest"
import { assignExperienceVariant, resolveExperienceExperimentConfig } from "./experience-experiment"

describe("experience routing experiment", () => {
  it("falls back to the configured default when the experiment is disabled", () => {
    expect(assignExperienceVariant({
      experimentId: "visitor-1",
      enabled: false,
      defaultVariant: "fullscreen_choice",
      weights: {
        fullscreen_choice: 0,
        normal_with_interactive_cta: 100,
        device_recommendation: 0,
        returning_preference: 0,
      },
    })).toBe("fullscreen_choice")
  })

  it("uses returning preference variant when an explicit preference cookie exists", () => {
    expect(assignExperienceVariant({
      experimentId: "visitor-1",
      preference: "interactive",
      enabled: true,
      defaultVariant: "fullscreen_choice",
      weights: {
        fullscreen_choice: 100,
        normal_with_interactive_cta: 0,
        device_recommendation: 0,
        returning_preference: 0,
      },
    })).toBe("returning_preference")
  })

  it("keeps existing assignments stable", () => {
    expect(assignExperienceVariant({
      experimentId: "visitor-1",
      existingVariant: "device_recommendation",
      enabled: true,
      defaultVariant: "fullscreen_choice",
      weights: {
        fullscreen_choice: 100,
        normal_with_interactive_cta: 0,
        device_recommendation: 0,
        returning_preference: 0,
      },
    })).toBe("device_recommendation")
  })

  it("parses rollout guardrails from environment", () => {
    const config = resolveExperienceExperimentConfig({
      NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_ENABLED: "true",
      NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_DEFAULT_VARIANT: "normal_with_interactive_cta",
      NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_WEIGHTS: "fullscreen_choice:0,normal_with_interactive_cta:100,device_recommendation:0,returning_preference:0",
    })

    expect(config.enabled).toBe(true)
    expect(config.defaultVariant).toBe("normal_with_interactive_cta")
    expect(config.weights.normal_with_interactive_cta).toBe(100)
  })
})
