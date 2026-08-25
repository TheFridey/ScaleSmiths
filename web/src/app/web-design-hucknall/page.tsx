import { LandingPage, getLandingPage } from "@/components/LandingPage"
import { metadataForLandingPage } from "@/lib/landing-pages"

const basePage = getLandingPage("web-design-hucknall")
const page = { ...basePage, proofLinks: ["precision-finish-plastering-rendering", "glow-tanning"] }

export const metadata = metadataForLandingPage(page)

export default function WebDesignHucknallPage() {
  return <LandingPage page={page} />
}
