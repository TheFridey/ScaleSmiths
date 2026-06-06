import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const page = getLandingPage("e-commerce-development-nottingham")

export const metadata = metadataForLandingPage(page)

export default function EcommerceDevelopmentNottinghamPage() {
  return <LandingPage page={page} />
}
