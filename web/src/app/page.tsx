import type { Metadata } from "next"
import { HomePageContent } from "@/components/HomePageContent"

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

/**
 * Homepage always renders the normal ScaleSmiths site.
 * The interactive project planner stays a public /interactive route,
 * discoverable via secondary CTAs, never a forced entry gate.
 */
export default async function HomePage() {
  return <HomePageContent />
}
