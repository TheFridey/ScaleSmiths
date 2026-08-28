export const APPLICATION_SCHEMAS = ["public", "drizzle"]

export const WEB_TABLE_GRANTS = new Map([
  ["quote_requests", ["SELECT", "INSERT", "UPDATE"]],
  ["quote_rate_limits", ["SELECT", "INSERT", "UPDATE"]],
  ["login_rate_limits", ["SELECT", "INSERT", "UPDATE"]],
  ["portal_client_accounts", ["SELECT"]],
  ["client_requests", ["SELECT", "INSERT", "UPDATE"]],
  ["client_request_messages", ["SELECT", "INSERT"]],
  ["client_timeline_events", ["SELECT", "INSERT"]],
  ["monthly_reports", ["SELECT"]],
  ["experience_events", ["INSERT"]],
  ["public_verified_claims", ["SELECT"]],
  ["clients", ["SELECT"]],
  ["invoices", ["SELECT"]],
  ["invoice_items", ["SELECT"]],
  ["invoice_portal_access_events", ["INSERT"]],
])

export const WEB_INSERT_TABLES = [...WEB_TABLE_GRANTS]
  .filter(([, operations]) => operations.includes("INSERT"))
  .map(([table]) => table)

export const ADMIN_FUNCTION_GRANTS = [
  { schema: "public", name: "digest", arguments: "bytea, text" },
  { schema: "public", name: "digest", arguments: "text, text" },
  { schema: "public", name: "gen_random_uuid", arguments: "" },
]

export const ADMIN_DELETE_TABLES = [
  "forge_jobs",
  "invoice_items",
  "invoices",
  "public_claim_evidence",
  "rate_limit_counters",
]

export const RUNTIME_FORBIDDEN_TABLE_PRIVILEGES = ["TRUNCATE", "REFERENCES", "TRIGGER"]
