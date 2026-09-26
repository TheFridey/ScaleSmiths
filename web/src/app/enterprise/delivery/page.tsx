import { EnterpriseDeliveryPage } from "@/components/EnterpriseDeliveryPage"
import { metadataForEnterpriseDeliveryPage } from "@/lib/enterprise-delivery-page"

export const metadata = metadataForEnterpriseDeliveryPage()

export default function EnterpriseDeliveryRoutePage() {
  return <EnterpriseDeliveryPage />
}
