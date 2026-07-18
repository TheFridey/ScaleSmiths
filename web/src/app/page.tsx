import type { Metadata } from "next"
import { headers } from "next/headers"
import { HomeExperienceGate } from "@/components/ExperiencePreference"
import { HomePageContent } from "@/components/HomePageContent"
import {
  EXPERIENCE_EXPERIMENT_HEADER,
  EXPERIENCE_PREFERENCE_HEADER,
  DEFAULT_EXPERIENCE_VARIANT,
  isExperienceExperimentVariant,
  normalizeStoredPreference,
} from "@/lib/experience-experiment"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
}

export default async function HomePage() {
  const headerStore = await headers()
  const variantHeader = headerStore.get(EXPERIENCE_EXPERIMENT_HEADER)
  const experimentVariant = isExperienceExperimentVariant(variantHeader) ? variantHeader : DEFAULT_EXPERIENCE_VARIANT
  const initialPreference = normalizeStoredPreference(headerStore.get(EXPERIENCE_PREFERENCE_HEADER))

  return (
    <HomeExperienceGate initialVariant={experimentVariant} initialPreference={initialPreference}>
      <HomePageContent />
    </HomeExperienceGate>
  )
}
