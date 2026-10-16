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

/** Adds campaign labels so an external scheduler can show which ScaleSmiths page sent the visitor. */
export function withBookingAttribution(href: string, source: string) {
  const url = new URL(href)
  const content = source.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)
  if (!url.searchParams.has("utm_source")) url.searchParams.set("utm_source", "scalesmiths")
  if (!url.searchParams.has("utm_medium")) url.searchParams.set("utm_medium", "referral")
  if (!url.searchParams.has("utm_campaign")) url.searchParams.set("utm_campaign", "discovery_call")
  if (content && !url.searchParams.has("utm_content")) url.searchParams.set("utm_content", content)
  return url.toString()
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
