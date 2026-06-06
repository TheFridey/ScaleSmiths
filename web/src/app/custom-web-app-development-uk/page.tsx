import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const page = getLandingPage("custom-web-app-development-uk")

export const metadata = metadataForLandingPage(page)

export default function CustomWebAppDevelopmentUkPage() {
  return <LandingPage page={page} />
}
