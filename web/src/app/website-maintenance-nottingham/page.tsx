import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const page = getLandingPage("website-maintenance-nottingham")

export const metadata = metadataForLandingPage(page)

export default function Page() {
  return <LandingPage page={page} />
}
