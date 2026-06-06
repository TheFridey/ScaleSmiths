import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const page = getLandingPage("next-js-agency-uk")

export const metadata = metadataForLandingPage(page)

export default function NextJsAgencyUkPage() {
  return <LandingPage page={page} />
}
