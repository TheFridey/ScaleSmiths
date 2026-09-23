import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const page = getLandingPage("custom-software-development-uk")

export const metadata = metadataForLandingPage(page)

export default function Page() {
  return <LandingPage page={page} />
}
