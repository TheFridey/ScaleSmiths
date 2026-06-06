import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const page = getLandingPage("web-development-nottingham")

export const metadata = metadataForLandingPage(page)

export default function WebDevelopmentNottinghamPage() {
  return <LandingPage page={page} />
}
