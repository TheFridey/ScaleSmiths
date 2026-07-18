"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { resolveDiscoveryCallAction } from "@/lib/discovery-booking"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"

export function DiscoveryCallLink({ className, source }: { className: string; source: string }) {
  const action = resolveDiscoveryCallAction()

  function trackExternalBooking() {
    trackExperienceEvent("quote_cta_clicked", {
      metadata: {
        source,
        intent: "discovery_call",
        target: action.kind === "booking" ? "external_booking" : action.href,
        ...(action.kind === "booking" ? { destinationHost: action.destinationHost } : {}),
      },
    })
  }

  if (action.kind === "booking") {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={trackExternalBooking}
        aria-label={`${action.label} (opens external scheduling site in a new tab)`}
        data-magnetic
      >
        {action.label}
        <ExternalLink size={15} aria-hidden="true" />
        <span className="sr-only"> (external scheduling site)</span>
      </a>
    )
  }

  return (
    <Link href={action.href} prefetch={false} className={className} data-magnetic>
      {action.label}
    </Link>
  )
}
