export const EXPERIENCE_EXPERIMENT_COOKIE = "ss_exp_variant"
export const EXPERIENCE_EXPERIMENT_ID_COOKIE = "ss_exp_id"
export const EXPERIENCE_PREFERENCE_COOKIE = "ss_experience_preference"
export const EXPERIENCE_EXPERIMENT_HEADER = "x-scalesmiths-experience-variant"
export const EXPERIENCE_PREFERENCE_HEADER = "x-scalesmiths-experience-preference"

export const EXPERIENCE_EXPERIMENT_VARIANTS = [
  "fullscreen_choice",
  "normal_with_interactive_cta",
  "device_recommendation",
  "returning_preference",
] as const

export type ExperienceExperimentVariant = (typeof EXPERIENCE_EXPERIMENT_VARIANTS)[number]
export type StoredExperiencePreference = "normal" | "interactive"

export const DEFAULT_EXPERIENCE_VARIANT: ExperienceExperimentVariant = "fullscreen_choice"

const VARIANT_SET = new Set<string>(EXPERIENCE_EXPERIMENT_VARIANTS)

export function isExperienceExperimentVariant(value: unknown): value is ExperienceExperimentVariant {
  return typeof value === "string" && VARIANT_SET.has(value)
}

type ExperienceExperimentEnv = Record<string, string | undefined>

export function resolveExperienceExperimentConfig(env: ExperienceExperimentEnv = process.env) {
  const enabled = env.NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_ENABLED === "true"
  const defaultVariant = isExperienceExperimentVariant(env.NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_DEFAULT_VARIANT)
    ? env.NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_DEFAULT_VARIANT
    : DEFAULT_EXPERIENCE_VARIANT
  return {
    enabled,
    defaultVariant,
    weights: parseWeights(env.NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_WEIGHTS),
  }
}

export function assignExperienceVariant(input: {
  experimentId: string
  existingVariant?: string | null
  preference?: string | null
  enabled: boolean
  defaultVariant: ExperienceExperimentVariant
  weights: Record<ExperienceExperimentVariant, number>
}): ExperienceExperimentVariant {
  if (!input.enabled) return input.defaultVariant
  if (input.preference === "normal" || input.preference === "interactive") return "returning_preference"
  if (isExperienceExperimentVariant(input.existingVariant)) return input.existingVariant

  const total = EXPERIENCE_EXPERIMENT_VARIANTS.reduce((sum, variant) => sum + Math.max(0, input.weights[variant] ?? 0), 0)
  if (total <= 0) return input.defaultVariant

  const bucket = stableBucket(input.experimentId) % total
  let cursor = 0
  for (const variant of EXPERIENCE_EXPERIMENT_VARIANTS) {
    cursor += Math.max(0, input.weights[variant] ?? 0)
    if (bucket < cursor) return variant
  }
  return input.defaultVariant
}

export function normalizeStoredPreference(value: unknown): StoredExperiencePreference | null {
  return value === "normal" || value === "interactive" ? value : null
}

function parseWeights(value: string | undefined): Record<ExperienceExperimentVariant, number> {
  const fallback = {
    fullscreen_choice: 25,
    normal_with_interactive_cta: 25,
    device_recommendation: 25,
    returning_preference: 25,
  }
  if (!value) return fallback

  const parsed = { ...fallback }
  for (const pair of value.split(",")) {
    const [key, rawWeight] = pair.split(":")
    if (!isExperienceExperimentVariant(key)) continue
    const weight = Number(rawWeight)
    if (Number.isFinite(weight) && weight >= 0) parsed[key] = Math.round(weight)
  }
  return parsed
}

function stableBucket(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
