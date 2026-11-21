export const APPLICATION_SCHEMAS = ["public", "drizzle"]

export const WEB_APPLICANT_INSERT_COLUMNS = [
  "name", "email", "phone", "region", "experience", "business_activity",
  "networks", "industries", "motivation", "linkedin", "privacy_version", "retention_until",
]

export const WEB_TABLE_GRANTS = new Map([
  ["quote_requests", ["SELECT", "INSERT", "UPDATE"]],
  ["quote_rate_limits", ["SELECT", "INSERT", "UPDATE"]],
  ["login_rate_limits", ["SELECT", "INSERT", "UPDATE"]],
  ["portal_client_accounts", ["SELECT", "UPDATE"]],
  ["portal_account_tokens", ["SELECT", "UPDATE"]],
  ["client_requests", ["SELECT", "INSERT", "UPDATE"]],
  ["client_request_messages", ["SELECT", "INSERT"]],
  ["client_timeline_events", ["SELECT", "INSERT"]],
  ["monthly_reports", ["SELECT"]],
  ["experience_events", ["INSERT"]],
  ["public_verified_claims", ["SELECT"]],
  // The ONLY partner-profile surface the public web role may read: a security-barrier view of founder-published, still-live, still-entitled profiles.
  ["expansion_public_partner_profiles", ["SELECT"]],
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

export const WEB_INSERT_TABLES = [
  "partner_applications", // Column-level INSERT still needs its sequence.
  ...[...WEB_TABLE_GRANTS].filter(([, operations]) => operations.includes("INSERT")).map(([table]) => table),
]

export const ADMIN_FUNCTION_GRANTS = [
  { schema: "public", name: "digest", arguments: "bytea, text" },
  { schema: "public", name: "digest", arguments: "text, text" },
  { schema: "public", name: "gen_random_uuid", arguments: "" },
  // Called by name from inside trigger bodies, which run as the invoking runtime role (trigger functions themselves need no grant).
  { schema: "public", name: "expansion_flag_qualifications", arguments: "uuid, text, text" },
  { schema: "public", name: "expansion_partner_entitlement_ok", arguments: "uuid, integer" },
  // Operation Empower B1.2: course structure and Academy servability, called from trigger bodies and Academy reads.
  { schema: "public", name: "empower_course_lesson_ids", arguments: "jsonb" },
  { schema: "public", name: "empower_academy_lesson_servable", arguments: "uuid, uuid" },
  // Operation Empower B1.3: Resource Centre search document (index expression and queries).
  { schema: "public", name: "empower_search_document", arguments: "text, text, jsonb" },
  // Operation Empower B1.5: objection field and client-line checks, called from the objection trigger body.
  { schema: "public", name: "empower_objection_fields_problem", arguments: "jsonb" },
  { schema: "public", name: "empower_client_line_leaks", arguments: "text" },
]

export const TENANT_RLS_FUNCTION_GRANTS = [
  { schema: "public", name: "app_current_tenant_id", arguments: "" },
  { schema: "public", name: "app_access_mode", arguments: "" },
  { schema: "public", name: "app_is_internal_aggregate", arguments: "" },
  { schema: "public", name: "app_is_internal_write", arguments: "" },
  { schema: "public", name: "app_client_owned_visible", arguments: "integer" },
  { schema: "public", name: "app_forge_row_visible", arguments: "integer" },
]

export const ADMIN_DELETE_TABLES = [
  "expansion_payout_claims",
  "expansion_applicant_retention_holds",
  // Founder retention workflow deletes expired, unlinked applicants only.
  "partner_applications",
  // Revoked/expired notification endpoints must be removed by the private runtime.
  "megaton_push_devices",
  "delivery_forge_integrations",
  "forge_jobs",
  "invoice_items",
  "invoices",
  "public_claim_evidence",
  "rate_limit_counters",
  // Pruned by the admin worker on behalf of the web runtime, which holds no
  // DELETE privilege of its own.
  "web_rate_limits",
  // Client analytics retention job. Deletes are tenant-scoped through RLS.
  "client_analytics_daily_metrics",
  "client_analytics_audit_logs",
  "client_optimisation_proposals",
]

export const RUNTIME_FORBIDDEN_TABLE_PRIVILEGES = ["TRUNCATE", "REFERENCES", "TRIGGER"]
