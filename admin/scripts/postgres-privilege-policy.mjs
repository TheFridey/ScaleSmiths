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
  ["delivery_projects", ["SELECT"]],
  ["delivery_milestones", ["SELECT"]],
  ["delivery_deliverables", ["SELECT"]],
  ["delivery_resources", ["SELECT"]],
  ["client_documents", ["SELECT"]],
  ["client_document_access_events", ["INSERT"]],
  ["delivery_decisions", ["SELECT"]],
  ["delivery_project_progress", ["SELECT"]],
  // Durable counters for the public rate limits. Web upserts its own counters
  // but never deletes: expired rows are pruned by the admin worker.
  ["web_rate_limits", ["SELECT", "INSERT", "UPDATE"]],
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
  "delivery_forge_integrations",
  "forge_jobs",
  "invoice_items",
  "invoices",
  "public_claim_evidence",
  "rate_limit_counters",
  // Pruned by the admin worker on behalf of the web runtime, which holds no
  // DELETE privilege of its own.
  "web_rate_limits",
]

export const RUNTIME_FORBIDDEN_TABLE_PRIVILEGES = ["TRUNCATE", "REFERENCES", "TRIGGER"]
