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

const homeDescription =
  "Websites, custom systems and ongoing digital growth from a founder-led team in Hucknall, Nottinghamshire, working with businesses across the UK."

export const metadata: Metadata = {
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "ScaleSmiths",
    url: "/",
    title: "ScaleSmiths | Forge Your Digital Edge",
    description: homeDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "ScaleSmiths | Forge Your Digital Edge",
    description: homeDescription,
  },
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
