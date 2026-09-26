import { SecurityPage } from "@/components/SecurityPage"
import { metadataForSecurityPage } from "@/lib/security-page"

export const metadata = metadataForSecurityPage()

export default function SecurityRoutePage() {
  return <SecurityPage />
}
