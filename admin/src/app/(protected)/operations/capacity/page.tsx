import type { Metadata } from "next"
import { DeliveryCapacityDashboard } from "@/components/operations/DeliveryCapacityDashboard"
import { loadDeliveryCapacityForecast } from "@/lib/server/delivery-capacity"

export const metadata: Metadata = { title: "Delivery capacity" }
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function DeliveryCapacityPage() {
  const forecast = await loadDeliveryCapacityForecast()
  return <DeliveryCapacityDashboard forecast={forecast} />
}
