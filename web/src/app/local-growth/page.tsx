import { ServiceJourneyPage } from "@/components/ServiceJourneyPage"
import { metadataForServiceJourney, serviceJourneys } from "@/lib/service-journeys"

const journey = serviceJourneys["local-growth"]

export const metadata = metadataForServiceJourney(journey)

export default function LocalGrowthPage() {
  return <ServiceJourneyPage journey={journey} />
}
