import type { ForgeIntakeInterpretation, ForgeProjectIntakeInput } from "./forge-project-intake"

export interface ForgeIntakeDraft {
  step: 1 | 2
  input: ForgeProjectIntakeInput
  interpretation: ForgeIntakeInterpretation | null
  summary: ForgeIntakeInterpretation["summary"] | null
  submissionKey: string
  savedAt: string
}

export function serializeForgeIntakeDraft(draft: ForgeIntakeDraft) {
  return JSON.stringify(draft)
}

export function parseForgeIntakeDraft(value: string | null): ForgeIntakeDraft | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<ForgeIntakeDraft>
    if ((parsed.step !== 1 && parsed.step !== 2) || !parsed.input || typeof parsed.submissionKey !== "string" || typeof parsed.savedAt !== "string") return null
    return {
      step: parsed.step,
      input: parsed.input,
      interpretation: parsed.interpretation ?? null,
      summary: parsed.summary ?? null,
      submissionKey: parsed.submissionKey,
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}
