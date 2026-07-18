import { ServiceJourneyPage } from "@/components/ServiceJourneyPage"
import { metadataForServiceJourney, serviceJourneys } from "@/lib/service-journeys"

const journey = serviceJourneys["custom-systems"]

export const metadata = metadataForServiceJourney(journey)

export default function CustomSystemsPage() {
  return <ServiceJourneyPage journey={journey} />
}
