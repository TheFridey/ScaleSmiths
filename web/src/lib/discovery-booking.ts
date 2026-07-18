import { enquiryIntentHref } from "./enquiry-intents"

export type DiscoveryCallAction =
  | { kind: "booking"; href: string; label: "Book a Discovery Call"; external: true; destinationHost: string }
  | { kind: "enquiry"; href: string; label: "Request a Discovery Call"; external: false }

export function resolveDiscoveryCallAction(rawUrl = process.env.NEXT_PUBLIC_DISCOVERY_BOOKING_URL): DiscoveryCallAction {
  const configured = validBookingUrl(rawUrl)
  if (!configured) {
    return {
      kind: "enquiry",
      href: enquiryIntentHref("discovery_call"),
      label: "Request a Discovery Call",
      external: false,
    }
  }

  return {
    kind: "booking",
    href: configured.toString(),
    label: "Book a Discovery Call",
    external: true,
    destinationHost: configured.hostname,
  }
}

export function validBookingUrl(rawUrl: string | undefined) {
  if (!rawUrl?.trim()) return null
  try {
    const url = new URL(rawUrl.trim())
    if (url.protocol !== "https:" || url.username || url.password) return null
    return url
  } catch {
    return null
  }
}
