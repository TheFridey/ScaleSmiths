import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const page = getLandingPage("web-design-hucknall")

export const metadata = metadataForLandingPage(page)

export default function WebDesignHucknallPage() {
  return <LandingPage page={page} />
}
