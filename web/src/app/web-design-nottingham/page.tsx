import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const page = getLandingPage("web-design-nottingham")

export const metadata = metadataForLandingPage(page)

export default function WebDesignNottinghamPage() {
  return <LandingPage page={page} />
}
