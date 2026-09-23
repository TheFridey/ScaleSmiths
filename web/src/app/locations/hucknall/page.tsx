import { LocationPage } from "@/components/LocationPage"
import { locationPages, metadataForLocation } from "@/lib/location-pages"

const page = locationPages.hucknall
export const metadata = metadataForLocation(page)
export default function HucknallLocationPage() { return <LocationPage page={page} /> }
