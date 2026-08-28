// Persisted shared-database contract. Web owns the table/migrations; both apps consume the values.
export const CLIENT_REQUEST_STATUSES = ["new", "triaged", "in_progress", "waiting_client", "completed", "cancelled"] as const
export type ClientRequestStatus = (typeof CLIENT_REQUEST_STATUSES)[number]
