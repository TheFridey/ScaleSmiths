export const CLIENT_DELIVERY_STATUSES = ["planning", "build_in_progress", "quality_checks", "ready_for_review", "changes_requested", "preparing_launch", "deployed", "on_hold"] as const
export type ClientDeliveryStatus = typeof CLIENT_DELIVERY_STATUSES[number]
export const INTERNAL_DELIVERY_EVENTS = ["planning_complete", "build_started", "quality_checks_started", "ready_for_review", "staging_ready", "changes_requested", "preparing_launch", "deployed"] as const
export type InternalDeliveryEvent = typeof INTERNAL_DELIVERY_EVENTS[number]

const SAFE_PROJECTIONS: Record<InternalDeliveryEvent, { status: ClientDeliveryStatus; title: string; description: string; nextStep: string }> = {
  planning_complete: { status: "planning", title: "Project planning complete", description: "Project planning is complete and delivery is being prepared.", nextStep: "Build preparation" },
  build_started: { status: "build_in_progress", title: "Build in progress", description: "Your project build is now in progress.", nextStep: "Internal quality checks" },
  quality_checks_started: { status: "quality_checks", title: "Internal quality checks underway", description: "Your latest build is going through internal quality checks.", nextStep: "Prepare for client review" },
  ready_for_review: { status: "ready_for_review", title: "Ready for your review", description: "The latest project version is ready for your review.", nextStep: "Client review" },
  staging_ready: { status: "ready_for_review", title: "Staging preview ready", description: "A staging preview is available for your review.", nextStep: "Review the staging website" },
  changes_requested: { status: "changes_requested", title: "Changes in progress", description: "Requested changes are being prepared.", nextStep: "Complete requested changes" },
  preparing_launch: { status: "preparing_launch", title: "Preparing for launch", description: "Final launch preparation is underway.", nextStep: "Launch checks" },
  deployed: { status: "deployed", title: "Latest build deployed", description: "Your latest build has been deployed.", nextStep: "Post-launch checks" },
}

export function sanitiseInternalDeliveryEvent(event: InternalDeliveryEvent) { return SAFE_PROJECTIONS[event] }
export function isInternalDeliveryEvent(value: unknown): value is InternalDeliveryEvent { return typeof value === "string" && (INTERNAL_DELIVERY_EVENTS as readonly string[]).includes(value) }
export function assertSafeClientStagingUrl(value: string) {
  const url = new URL(value)
  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Client staging URLs must be credential-free HTTPS URLs.")
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1" || hostname === "admin.scalesmiths.co.uk") throw new Error("Internal or admin URLs cannot be published to clients.")
  const sensitive = `${url.pathname}${url.search}`.toLowerCase()
  if (/(?:token|secret|key|credential|forge|generated-sites|sandbox)/.test(sensitive)) throw new Error("The staging URL contains internal or sensitive information.")
  return url.toString()
}
