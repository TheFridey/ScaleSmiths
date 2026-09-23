import { LocationPage } from "@/components/LocationPage"
import { locationPages, metadataForLocation } from "@/lib/location-pages"

const page = locationPages.nottingham
export const metadata = metadataForLocation(page)
export default function NottinghamLocationPage() { return <LocationPage page={page} /> }
