import type { Metadata } from "next"
import { HomePageContent } from "@/components/HomePageContent"
import { JsonLd } from "@/components/JsonLd"
import { siteBaseUrl } from "@/lib/site-identity"
import { buildWebPageSchema } from "@/lib/structured-data"

const homeDescription =
  "Websites, visibility and business systems that attract enquiries and reduce wasted time. Founder-led from Hucknall, working across the UK and remotely."

export const metadata: Metadata = {
  title: { absolute: "Websites, Visibility and Business Systems | ScaleSmiths" },
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "ScaleSmiths",
    url: "/",
    title: "Forge Your Digital Edge | ScaleSmiths",
    description: homeDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Forge Your Digital Edge | ScaleSmiths",
    description: homeDescription,
  },
}

/**
 * Homepage always renders the normal ScaleSmiths site.
 * The interactive project planner stays a public /interactive route,
 * discoverable via secondary CTAs, never a forced entry gate.
 */
export default async function HomePage() {
  return (
    <>
      <JsonLd
        data={buildWebPageSchema(siteBaseUrl(), {
          name: "ScaleSmiths",
          description: homeDescription,
          path: "/",
        })}
      />
      <HomePageContent />
    </>
  )
}
