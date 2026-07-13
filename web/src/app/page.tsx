import type { Metadata } from "next"
import { headers } from "next/headers"
import { HomeExperienceGate } from "@/components/ExperiencePreference"
import { HomePageContent } from "@/components/HomePageContent"
import { EXPERIENCE_EXPERIMENT_HEADER, DEFAULT_EXPERIENCE_VARIANT, isExperienceExperimentVariant } from "@/lib/experience-experiment"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default async function HomePage() {
  const headerStore = await headers()
  const variantHeader = headerStore.get(EXPERIENCE_EXPERIMENT_HEADER)
  const experimentVariant = isExperienceExperimentVariant(variantHeader) ? variantHeader : DEFAULT_EXPERIENCE_VARIANT

  return (
    <HomeExperienceGate initialVariant={experimentVariant}>
      <HomePageContent />
    </HomeExperienceGate>
  )
}
