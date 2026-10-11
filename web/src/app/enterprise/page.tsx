import { EnterprisePage } from "@/components/EnterprisePage"
import { metadataForEnterprisePage } from "@/lib/enterprise-page"

export const metadata = metadataForEnterprisePage()

export default function EnterpriseRoutePage() {
  return <EnterprisePage />
}
