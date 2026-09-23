import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const page = getLandingPage("local-seo-nottingham")

export const metadata = metadataForLandingPage(page)

export default function Page() {
  return <LandingPage page={page} />
}
