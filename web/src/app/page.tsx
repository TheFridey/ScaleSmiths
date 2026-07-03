import type { Metadata } from "next"
import { HomeExperienceGate } from "@/components/ExperiencePreference"
import { HomePageContent } from "@/components/HomePageContent"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default function HomePage() {
  return (
    <HomeExperienceGate>
      <HomePageContent />
    </HomeExperienceGate>
  )
}
