import type { Metadata } from "next"
import { ExperienceSwitchControl } from "@/components/ExperiencePreference"
import { HomePageContent } from "@/components/HomePageContent"

export const metadata: Metadata = {
  title: "Traditional Website Experience",
  description:
    "Explore the standard ScaleSmiths website for strategy-led web development, e-commerce, portals, automation and digital infrastructure.",
  alternates: { canonical: "/traditional" },
}

export default function TraditionalPage() {
  return (
    <>
      <ExperienceSwitchControl current="normal" />
      <HomePageContent />
    </>
  )
}
