import type { ForgeIntakeData } from "./forge"
import type { ForgeFrontendSeoContext } from "./forge-frontend-code"

/**
 * Derives the location/entity context the SEO engine needs from approved intake data.
 * Telephone/email/social profiles are left null until captured explicitly so the
 * generated LocalBusiness schema never invents contact details.
 */
export function buildForgeSeoContextFromIntake(intake: ForgeIntakeData | null | undefined): ForgeFrontendSeoContext {
  if (!intake) {
    return { primaryLocation: null, serviceAreas: [], telephone: null, email: null, sameAs: [] }
  }

  const primaryLocation = clean(intake.primaryLocation) || clean(intake.businessLocation) || null
  const serviceAreas = splitList(intake.serviceAreas)

  return {
    primaryLocation,
    serviceAreas,
    telephone: null,
    email: null,
    sameAs: [],
  }
}

function clean(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : ""
}

function splitList(value: string | undefined | null): string[] {
  if (typeof value !== "string") return []
  return [...new Set(
    value
      .split(/\r?\n|,|;|•/)
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 12)
}
