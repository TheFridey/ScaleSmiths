import { EnterpriseWebsitesPage } from "@/components/EnterpriseWebsitesPage"
import { metadataForEnterpriseWebsitesPage } from "@/lib/enterprise-websites-page"

export const metadata = metadataForEnterpriseWebsitesPage()

export default function EnterpriseWebsitesRoutePage() {
  return <EnterpriseWebsitesPage />
}
