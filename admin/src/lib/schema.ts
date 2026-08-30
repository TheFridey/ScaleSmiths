import { relations, sql } from "drizzle-orm"
import { boolean, check, customType, index, integer, jsonb, numeric, pgEnum, pgTable, pgView, primaryKey, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import type { LeadScoreFactor, LeadScoreResult } from "./lead-scoring"
import type { ProjectEstimateResult } from "./project-estimator"
import type { OnboardingTemplate } from "./delivery-onboarding-templates"
import type { ForgeDependencyAdmissionReport } from "./forge-dependency-admission"
import type { ForgeRunPolicy } from "./forge-run-stages"
import type { ForgeOperatorError } from "./forge-operator-error"
import type { InvoicePaymentSnapshot, InvoiceSupplierSnapshot } from "./invoice-document"
import { CLIENT_REQUEST_STATUSES } from "./client-requests"
import { DEPLOYMENT_CANDIDATE_STATES } from "./forge-deployment-candidates"
import { FORGE_PROJECT_STATES, FORGE_TASK_STATES } from "./forge-state-machine"
import { INVOICE_STATUSES } from "./invoices"
import { MONTHLY_REPORT_STATUSES } from "./monthly-reports"
import { PROPOSAL_PACKAGE_TYPES, PROPOSAL_STATUSES, PROSPECT_PRIORITIES, PROSPECT_SOURCES, PROSPECT_STAGES } from "./prospects"

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" })

export const kanbanColumn = pgEnum("kanban_column", ["backlog", "progress", "review", "done"])
export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"])
export const quoteStatus = pgEnum("quote_status", ["new", "read", "replied", "reviewed", "contacted", "qualified", "won", "lost"])
export const prospectSource = pgEnum("prospect_source", PROSPECT_SOURCES)
export const prospectStage = pgEnum("prospect_stage", PROSPECT_STAGES)
export const prospectPriority = pgEnum("prospect_priority", PROSPECT_PRIORITIES)
export const outreachActivityType = pgEnum("outreach_activity_type", ["linkedin_message", "email", "phone_call", "facebook_message", "in_person", "follow_up", "proposal", "note"])
export const outreachDirection = pgEnum("outreach_direction", ["outbound", "inbound", "internal"])
export const proposalPackageType = pgEnum("proposal_package_type", PROPOSAL_PACKAGE_TYPES)
export const proposalStatus = pgEnum("proposal_status", PROPOSAL_STATUSES)
export const leadScoreOutcome = pgEnum("lead_score_outcome", ["won", "lost", "no_decision", "disqualified"])
export const projectEstimateComplexity = pgEnum("project_estimate_complexity", ["low", "medium", "high", "enterprise"])
export const forgeProjectStatus = pgEnum("forge_project_status", FORGE_PROJECT_STATES)
export const forgePriority = pgEnum("forge_priority", ["low", "medium", "high"])
export const forgeTaskAgentType = pgEnum("forge_task_agent_type", ["intake", "research", "strategy", "sitemap", "copy", "design", "frontend", "integration", "seo", "qa", "deploy", "repair"])
export const forgeTaskStatus = pgEnum("forge_task_status", FORGE_TASK_STATES)
export const forgeTaskResultQuality = pgEnum("forge_task_result_quality", ["validated", "degraded", "fallback", "requires_review", "failed"])
export const forgeArtifactType = pgEnum("forge_artifact_type", ["research_report", "sitemap", "copy_doc", "design_direction", "design_system", "component_spec", "generated_code", "visual_critique", "qa_report", "seo_pack", "visual_qa", "accessibility_report", "proposal", "handover_doc", "deployment_notes", "export_record", "consistency_report", "copy_quality_report", "council_review", "originality_report", "site_inventory", "migration_analysis", "migration_candidate"])
export const forgeIntegrationProvider = pgEnum("forge_integration_provider", ["resend", "whatsapp", "analytics", "calendly", "stripe", "cloudinary", "custom"])
export const clientRequestCategory = pgEnum("client_request_category", ["website_update", "website_issue", "form_issue", "seo_request", "new_page", "content_assets", "urgent_support", "general_support"])
export const clientRequestPriority = pgEnum("client_request_priority", ["low", "medium", "high", "critical"])
export const clientRequestStatus = pgEnum("client_request_status", CLIENT_REQUEST_STATUSES)
export const requestMessageSenderType = pgEnum("request_message_sender_type", ["client", "admin", "system"])
export const requestMessageVisibility = pgEnum("request_message_visibility", ["client_visible", "internal"])
export const monthlyReportStatus = pgEnum("monthly_report_status", MONTHLY_REPORT_STATUSES)
export const monthlyReportGeneratedBy = pgEnum("monthly_report_generated_by", ["forge", "manual"])
export const salesProposalGeneratedBy = pgEnum("sales_proposal_generated_by", ["forge", "manual"])
export const adminUserRole = pgEnum("admin_user_role", ["owner", "administrator", "sales", "project_manager", "developer", "finance", "viewer"])
export const deliveryCapacityAdjustmentType = pgEnum("delivery_capacity_adjustment_type", ["capacity_override", "time_off", "contractor_capacity", "sales_commitment", "actual_delivery"])
export const operatingBriefActionStatus = pgEnum("operating_brief_action_status", ["dismissed", "completed", "snoozed"])
export const analyticsProvider = pgEnum("analytics_provider", ["manual", "google_search_console", "google_analytics", "plausible", "uptime", "core_web_vitals", "custom"])
export const analyticsMetricSource = pgEnum("analytics_metric_source", ["analytics", "search_console", "forms", "phone", "performance", "errors", "uptime", "manual", "custom"])
export const optimisationProposalStatus = pgEnum("optimisation_proposal_status", ["proposed", "accepted", "rejected", "completed", "measured"])
export const experienceEventName = pgEnum("experience_event_name", [
  "experience_choice_displayed",
  "experience_normal_selected",
  "experience_interactive_selected",
  "experience_choice_abandoned",
  "experience_returning_preference",
  "experience_switched",
  "quote_cta_clicked",
  "quote_form_started",
  "quote_form_submitted",
  "navigation_exit",
  "interactive_completion_depth",
  "experience_fallback_activated",
  "experience_error",
  "local_growth_check_viewed",
  "local_growth_check_form_started",
  "local_growth_check_form_submitted",
  "local_growth_check_full_quote_selected",
  "local_growth_check_strategy_call_requested",
])
export const experienceDeviceClass = pgEnum("experience_device_class", ["mobile", "tablet", "desktop", "unknown"])
export const experiencePreference = pgEnum("experience_preference", ["normal", "interactive", "none", "unknown"])
export const invoiceStatus = pgEnum("invoice_status", INVOICE_STATUSES)
export const invoiceDeliveryType = pgEnum("invoice_delivery_type", ["invoice", "reminder"])
export const invoiceDeliveryState = pgEnum("invoice_delivery_state", ["pending", "sent", "failed"])
export const invoicePortalAccessType = pgEnum("invoice_portal_access_type", ["view", "download"])
export const deliveryProjectStatus = pgEnum("delivery_project_status", ["active", "paused", "completed", "cancelled"])
export const deliveryProjectPhase = pgEnum("delivery_project_phase", ["discovery", "strategy", "design", "build", "review", "launch", "ongoing"])
export const deliveryClientStatus = pgEnum("delivery_client_status", ["planning", "build_in_progress", "quality_checks", "ready_for_review", "changes_requested", "preparing_launch", "deployed", "on_hold"])
export const deliveryMilestoneStatus = pgEnum("delivery_milestone_status", ["planned", "active", "blocked", "completed", "skipped"])
export const deliveryDeliverableStatus = pgEnum("delivery_deliverable_status", ["planned", "in_progress", "in_review", "approved", "delivered", "cancelled"])
export const deliveryResourceKind = pgEnum("delivery_resource_kind", ["file", "link"])
export const clientDocumentType = pgEnum("client_document_type", ["brief", "proposal", "contract", "brand_asset", "content", "design", "staging_link", "launch_checklist", "handoff", "report", "technical", "other"])
export const clientDocumentSource = pgEnum("client_document_source", ["upload", "link"])
export const clientDocumentStorageProvider = pgEnum("client_document_storage_provider", ["r2", "external"])
export const deliveryDecisionStatus = pgEnum("delivery_decision_status", ["open", "resolved", "cancelled"])
export const deliveryOnboardingItemKind = pgEnum("delivery_onboarding_item_kind", ["task", "client_input", "document_request", "internal_check"])
export const deliveryOnboardingItemStatus = pgEnum("delivery_onboarding_item_status", ["not_started", "in_progress", "blocked", "completed", "not_required"])

export type PublicClaimStatus = "draft" | "verified" | "expired" | "rejected"
export type PublicClaimApprovalStatus = "pending" | "approved" | "declined" | "not_required"

export const publicClaims = pgTable("public_claims", {
  id: text("id").primaryKey(),
  approvedWording: text("approved_wording").notNull(),
  claimType: text("claim_type").notNull(),
  sourceName: text("source_name"),
  attributionName: text("attribution_name"),
  attributionBusiness: text("attribution_business"),
  clientApprovalStatus: text("client_approval_status").$type<PublicClaimApprovalStatus>().default("pending").notNull(),
  status: text("status").$type<PublicClaimStatus>().default("draft").notNull(),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  reviewExpiresAt: timestamp("review_expires_at", { withTimezone: true }),
  permittedRoutes: text("permitted_routes").array().default([]).notNull(),
  permittedComponents: text("permitted_components").array().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("public_claims_status_review_idx").on(table.status, table.reviewExpiresAt),
  index("public_claims_type_idx").on(table.claimType),
])

export const publicClaimEvidence = pgTable("public_claim_evidence", {
  id: serial("id").primaryKey(),
  claimId: text("claim_id").references(() => publicClaims.id, { onDelete: "cascade" }).notNull(),
  evidenceDescription: text("evidence_description").notNull(),
  evidenceReference: text("evidence_reference").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("public_claim_evidence_claim_idx").on(table.claimId),
])

export const publicClaimAuditLogs = pgTable("public_claim_audit_logs", {
  id: serial("id").primaryKey(),
  claimId: text("claim_id").references(() => publicClaims.id, { onDelete: "cascade" }).notNull(),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("public_claim_audit_claim_idx").on(table.claimId, table.createdAt),
  index("public_claim_audit_actor_idx").on(table.actorUserId, table.createdAt),
])

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: adminUserRole("role").notNull(),
  active: boolean("active").default(true).notNull(),
  mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
  mfaState: jsonb("mfa_state").$type<Record<string, unknown>>(),
  sessionVersion: integer("session_version").default(1).notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("admin_users_email_lower_idx").on(sql`lower(${table.email})`),
  index("admin_users_role_active_idx").on(table.role, table.active),
])

export const adminSecurityAudit = pgTable("admin_security_audit", {
  id: serial("id").primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  targetUserId: uuid("target_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  success: boolean("success").notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("admin_security_audit_actor_idx").on(table.actorUserId, table.createdAt),
  index("admin_security_audit_target_idx").on(table.targetUserId, table.createdAt),
  index("admin_security_audit_action_idx").on(table.action, table.createdAt),
])

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  tier: text("tier"),
  mrr: integer("mrr").default(0).notNull(),
  status: text("status").default("active").notNull(),
  progress: integer("progress").default(0).notNull(),
  invoiceClientCode: text("invoice_client_code"),
  nextInvoiceSequence: integer("next_invoice_sequence").default(1).notNull(),
  billingAddressLine1: text("billing_address_line_1"),
  billingAddressLine2: text("billing_address_line_2"),
  billingCity: text("billing_city"),
  billingCounty: text("billing_county"),
  billingPostcode: text("billing_postcode"),
  billingCountry: text("billing_country"),
  portalClientId: text("portal_client_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("clients_invoice_client_code_idx").on(table.invoiceClientCode),
  uniqueIndex("clients_portal_client_id_idx").on(table.portalClientId),
  check("clients_invoice_client_code_format_check", sql`${table.invoiceClientCode} is null or ${table.invoiceClientCode} ~ '^[A-Z0-9]{2,12}$'`),
  check("clients_next_invoice_sequence_check", sql`${table.nextInvoiceSequence} > 0`),
])

export const invoiceCatalogueItems = pgTable("invoice_catalogue_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  defaultUnitAmount: integer("default_unit_amount").notNull(),
  currency: text("currency").default("GBP").notNull(),
  active: boolean("active").default(true).notNull(),
  category: text("category"),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("invoice_catalogue_unit_amount_check", sql`${table.defaultUnitAmount} >= 0`),
  check("invoice_catalogue_currency_check", sql`${table.currency} = 'GBP'`),
])

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number"),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "restrict" }).notNull(),
  sequenceNumber: integer("sequence_number"),
  clientCodeSnapshot: text("client_code_snapshot"),
  clientNameSnapshot: text("client_name_snapshot").notNull(),
  billingContactNameSnapshot: text("billing_contact_name_snapshot"),
  billingEmailSnapshot: text("billing_email_snapshot"),
  billingAddressLine1Snapshot: text("billing_address_line_1_snapshot"),
  billingAddressLine2Snapshot: text("billing_address_line_2_snapshot"),
  billingCitySnapshot: text("billing_city_snapshot"),
  billingCountySnapshot: text("billing_county_snapshot"),
  billingPostcodeSnapshot: text("billing_postcode_snapshot"),
  billingCountrySnapshot: text("billing_country_snapshot"),
  currency: text("currency").default("GBP").notNull(),
  invoiceDate: timestamp("invoice_date", { withTimezone: true }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  status: invoiceStatus("status").default("draft").notNull(),
  subtotal: integer("subtotal").notNull(),
  total: integer("total").notNull(),
  internalNotes: text("internal_notes"),
  customerNotes: text("customer_notes"),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  documentTemplateVersion: text("document_template_version"),
  supplierSnapshot: jsonb("supplier_snapshot").$type<InvoiceSupplierSnapshot>(),
  paymentSnapshot: jsonb("payment_snapshot").$type<InvoicePaymentSnapshot>(),
  documentPdf: bytea("document_pdf"),
  documentPdfSha256: text("document_pdf_sha256"),
  portalPublishedAt: timestamp("portal_published_at", { withTimezone: true }),
  portalPublishedBy: uuid("portal_published_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("invoices_invoice_number_idx").on(table.invoiceNumber),
  uniqueIndex("invoices_client_sequence_idx").on(table.clientId, table.sequenceNumber),
  index("invoices_client_date_idx").on(table.clientId, table.invoiceDate),
  index("invoices_status_due_date_idx").on(table.status, table.dueDate),
  check("invoices_number_lifecycle_check", sql`(${table.status} = 'draft' and ${table.invoiceNumber} is null and ${table.sequenceNumber} is null and ${table.issuedAt} is null) or (${table.status} <> 'draft' and ${table.invoiceNumber} is not null and ${table.sequenceNumber} > 0 and ${table.issuedAt} is not null)`),
  check("invoices_document_snapshot_lifecycle_check", sql`(${table.status} = 'draft' and ${table.documentTemplateVersion} is null and ${table.supplierSnapshot} is null and ${table.paymentSnapshot} is null and ${table.documentPdf} is null and ${table.documentPdfSha256} is null) or (${table.status} <> 'draft' and ${table.documentTemplateVersion} is not null and ${table.supplierSnapshot} is not null and ${table.paymentSnapshot} is not null and ${table.documentPdf} is not null and ${table.documentPdfSha256} is not null)`),
  check("invoices_amounts_check", sql`${table.subtotal} >= 0 and ${table.total} = ${table.subtotal}`),
  check("invoices_currency_check", sql`${table.currency} = 'GBP'`),
  check("invoices_dates_check", sql`${table.dueDate} >= ${table.invoiceDate}`),
])

export const invoiceSupplierSettings = pgTable("invoice_supplier_settings", {
  id: integer("id").primaryKey().default(1),
  legalName: text("legal_name"),
  tradingName: text("trading_name"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  county: text("county"),
  postcode: text("postcode"),
  country: text("country"),
  contactEmail: text("contact_email"),
  website: text("website"),
  companyNumber: text("company_number"),
  vatNumber: text("vat_number"),
  paymentInstructions: text("payment_instructions"),
  paymentAccountName: text("payment_account_name"),
  paymentSortCode: text("payment_sort_code"),
  paymentAccountNumber: text("payment_account_number"),
  paymentReferenceInstructions: text("payment_reference_instructions"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check("invoice_supplier_settings_singleton_check", sql`${table.id} = 1`)])

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  catalogueItemId: integer("catalogue_item_id").references(() => invoiceCatalogueItems.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull(),
  unitAmount: integer("unit_amount").notNull(),
  lineAmount: integer("line_amount").notNull(),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("invoice_items_invoice_position_idx").on(table.invoiceId, table.position),
  check("invoice_items_quantity_check", sql`${table.quantity} > 0`),
  check("invoice_items_unit_amount_check", sql`${table.unitAmount} >= 0`),
  check("invoice_items_line_amount_check", sql`${table.lineAmount} = ${table.quantity} * ${table.unitAmount}`),
])

export const invoiceAuditLogs = pgTable("invoice_audit_logs", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("invoice_audit_invoice_idx").on(table.invoiceId, table.createdAt)])

export const kanbanCards = pgTable("kanban_cards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  column: kanbanColumn("column").default("backlog").notNull(),
  priority: text("priority").default("med").notNull(),
  tag: text("tag"),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const invoiceDeliveryAttempts = pgTable("invoice_delivery_attempts", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "restrict" }).notNull(),
  deliveryType: invoiceDeliveryType("delivery_type").notNull(),
  state: invoiceDeliveryState("state").default("pending").notNull(),
  channel: text("channel").default("email").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  operationKey: text("operation_key").notNull(),
  providerMessageId: text("provider_message_id"),
  documentSha256: text("document_sha256"),
  failureCategory: text("failure_category"),
  failureMessage: text("failure_message"),
  initiatedBy: uuid("initiated_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("invoice_delivery_operation_key_idx").on(table.operationKey),
  index("invoice_delivery_invoice_created_idx").on(table.invoiceId, table.createdAt),
])

export const invoicePortalAccessEvents = pgTable("invoice_portal_access_events", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "restrict" }).notNull(),
  portalClientId: text("portal_client_id").notNull(),
  accessType: invoicePortalAccessType("access_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("invoice_portal_access_invoice_idx").on(table.invoiceId, table.createdAt)])

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  direction: messageDirection("direction").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
})

export const clientRequests = pgTable("client_requests", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: clientRequestCategory("category").default("general_support").notNull(),
  priority: clientRequestPriority("priority").default("medium").notNull(),
  status: clientRequestStatus("status").default("new").notNull(),
  affectedUrl: text("affected_url"),
  pageUrl: text("page_url"),
  attachmentMetadata: jsonb("attachment_metadata").$type<Record<string, unknown>>(),
  internalNotes: text("internal_notes"),
  forgeSummary: text("forge_summary"),
  forgeSuggestedActions: text("forge_suggested_actions"),
  forgeSuggestedReply: text("forge_suggested_reply"),
  notificationEmailStatus: text("notification_email_status"),
  notificationEmailFailureReason: text("notification_email_failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  clientLastReadAt: timestamp("client_last_read_at", { withTimezone: true }),
  adminLastReadAt: timestamp("admin_last_read_at", { withTimezone: true }),
}, (table) => [
  index("client_requests_client_id_idx").on(table.clientId),
  index("client_requests_status_idx").on(table.status),
  index("client_requests_priority_idx").on(table.priority),
  index("client_requests_category_idx").on(table.category),
  index("client_requests_created_at_idx").on(table.createdAt),
])

export const clientRequestMessages = pgTable("client_request_messages", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").references(() => clientRequests.id, { onDelete: "cascade" }).notNull(),
  senderType: requestMessageSenderType("sender_type").notNull(),
  senderName: text("sender_name").notNull(),
  body: text("body").notNull(),
  visibility: requestMessageVisibility("visibility").default("client_visible").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  notificationEmailStatus: text("notification_email_status"),
  notificationEmailFailureReason: text("notification_email_failure_reason"),
}, (table) => [
  index("client_request_messages_request_id_idx").on(table.requestId),
  index("client_request_messages_visibility_idx").on(table.visibility),
  index("client_request_messages_created_at_idx").on(table.createdAt),
])

export const clientTimelineEvents = pgTable("client_timeline_events", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  clientRecordId: integer("client_record_id").references(() => clients.id, { onDelete: "restrict" }),
  requestId: integer("request_id").references(() => clientRequests.id, { onDelete: "cascade" }),
  projectId: integer("project_id"),
  sourceDomain: text("source_domain"),
  sourceReference: text("source_reference"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  visibility: requestMessageVisibility("visibility").default("client_visible").notNull(),
  createdBy: text("created_by").notNull(),
  actorType: text("actor_type"),
  actorId: text("actor_id"),
  actorLabel: text("actor_label"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
  idempotencyKey: text("idempotency_key"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("client_timeline_events_client_id_idx").on(table.clientId),
  index("client_timeline_events_client_record_idx").on(table.clientRecordId, table.occurredAt),
  index("client_timeline_events_request_id_idx").on(table.requestId),
  index("client_timeline_events_project_id_idx").on(table.projectId),
  index("client_timeline_events_visibility_idx").on(table.visibility),
  index("client_timeline_events_created_at_idx").on(table.createdAt),
  uniqueIndex("client_timeline_events_idempotency_idx").on(table.idempotencyKey),
])

export const deliveryProjects = pgTable("delivery_projects", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(),
  summary: text("summary"),
  internalNotes: text("internal_notes"),
  clientVisible: boolean("client_visible").default(false).notNull(),
  status: deliveryProjectStatus("status").default("active").notNull(),
  currentPhase: deliveryProjectPhase("current_phase").default("discovery").notNull(),
  clientStatus: deliveryClientStatus("client_status").default("planning").notNull(),
  clientNextStep: text("client_next_step"),
  clientStagingUrl: text("client_staging_url"),
  clientStagingVisible: boolean("client_staging_visible").default(false).notNull(),
  ownerUserId: uuid("owner_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  targetStartDate: timestamp("target_start_date", { withTimezone: true }),
  targetEndDate: timestamp("target_end_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // Database foreign keys link these ids to Forge-owned tables. Keeping the Drizzle
  // declarations as ids avoids making delivery's public schema depend on Forge internals.
  forgeProjectId: integer("forge_project_id"),
  deploymentCandidateId: integer("deployment_candidate_id"),
  onboardingTemplateKey: text("onboarding_template_key"),
  onboardingTemplateVersion: integer("onboarding_template_version"),
  onboardingTemplateSnapshot: jsonb("onboarding_template_snapshot").$type<OnboardingTemplate>(),
  portalWelcomeTitle: text("portal_welcome_title"),
  portalWelcomeContent: text("portal_welcome_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("delivery_projects_client_status_idx").on(table.clientId, table.status),
  index("delivery_projects_owner_status_idx").on(table.ownerUserId, table.status),
  uniqueIndex("delivery_projects_forge_project_idx").on(table.forgeProjectId),
  check("delivery_projects_dates_check", sql`${table.targetEndDate} is null or ${table.targetStartDate} is null or ${table.targetEndDate} >= ${table.targetStartDate}`),
  check("delivery_projects_completion_check", sql`(${table.status} = 'completed' and ${table.completedAt} is not null) or (${table.status} <> 'completed' and ${table.completedAt} is null)`),
  check("delivery_projects_client_staging_check", sql`${table.clientStagingVisible} = false or ${table.clientStagingUrl} is not null`),
])

export const deliveryMilestones = pgTable("delivery_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => deliveryProjects.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  internalNotes: text("internal_notes"),
  status: deliveryMilestoneStatus("status").default("planned").notNull(),
  clientVisible: boolean("client_visible").default(false).notNull(),
  weight: integer("weight").default(1).notNull(),
  position: integer("position").default(0).notNull(),
  targetDate: timestamp("target_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("delivery_milestones_project_position_idx").on(table.projectId, table.position),
  index("delivery_milestones_project_visibility_idx").on(table.projectId, table.clientVisible),
  check("delivery_milestones_weight_check", sql`${table.weight} > 0`),
  check("delivery_milestones_position_check", sql`${table.position} >= 0`),
  check("delivery_milestones_completion_check", sql`(${table.status} = 'completed' and ${table.completedAt} is not null) or (${table.status} <> 'completed' and ${table.completedAt} is null)`),
])

export const deliveryDeliverables = pgTable("delivery_deliverables", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => deliveryProjects.id, { onDelete: "cascade" }).notNull(),
  milestoneId: integer("milestone_id").references(() => deliveryMilestones.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  internalNotes: text("internal_notes"),
  status: deliveryDeliverableStatus("status").default("planned").notNull(),
  clientVisible: boolean("client_visible").default(false).notNull(),
  ownerUserId: uuid("owner_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  targetDate: timestamp("target_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("delivery_deliverables_project_position_idx").on(table.projectId, table.position),
  index("delivery_deliverables_milestone_idx").on(table.milestoneId),
  check("delivery_deliverables_position_check", sql`${table.position} >= 0`),
])

export const deliveryResources = pgTable("delivery_resources", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => deliveryProjects.id, { onDelete: "cascade" }).notNull(),
  deliverableId: integer("deliverable_id").references(() => deliveryDeliverables.id, { onDelete: "set null" }),
  kind: deliveryResourceKind("kind").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  visibility: requestMessageVisibility("visibility").default("internal").notNull(),
  createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("delivery_resources_project_created_idx").on(table.projectId, table.createdAt),
  index("delivery_resources_deliverable_idx").on(table.deliverableId),
])

export const clientDocuments = pgTable("client_documents", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "restrict" }).notNull(),
  projectId: integer("project_id").references(() => deliveryProjects.id, { onDelete: "cascade" }).notNull(),
  deliverableId: integer("deliverable_id").references(() => deliveryDeliverables.id, { onDelete: "set null" }),
  documentType: clientDocumentType("document_type").notNull(),
  source: clientDocumentSource("source").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  originalFilename: text("original_filename"),
  storageProvider: clientDocumentStorageProvider("storage_provider").notNull(),
  storageKey: text("storage_key").notNull(),
  visibility: requestMessageVisibility("visibility").default("internal").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => adminUsers.id, { onDelete: "set null" }),
  version: integer("version").default(1).notNull(),
  checksumSha256: text("checksum_sha256"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("client_documents_client_project_idx").on(table.clientId, table.projectId, table.createdAt),
  index("client_documents_project_visibility_idx").on(table.projectId, table.visibility, table.archivedAt),
  uniqueIndex("client_documents_storage_key_idx").on(table.storageProvider, table.storageKey),
  check("client_documents_version_check", sql`${table.version} > 0`),
  check("client_documents_size_check", sql`${table.sizeBytes} is null or ${table.sizeBytes} >= 0`),
  check("client_documents_source_metadata_check", sql`(${table.source} = 'upload' and ${table.storageProvider} = 'r2' and ${table.originalFilename} is not null and ${table.checksumSha256} is not null and ${table.mimeType} is not null and ${table.sizeBytes} is not null) or (${table.source} = 'link' and ${table.storageProvider} = 'external' and ${table.checksumSha256} is null and ${table.sizeBytes} is null)`),
])

export const clientDocumentAccessEvents = pgTable("client_document_access_events", {
  id: serial("id").primaryKey(), documentId: integer("document_id").references(() => clientDocuments.id, { onDelete: "cascade" }).notNull(), portalClientId: text("portal_client_id").notNull(), action: text("action").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("client_document_access_document_idx").on(table.documentId, table.createdAt)])

export const deliveryDecisions = pgTable("delivery_decisions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => deliveryProjects.id, { onDelete: "cascade" }).notNull(),
  milestoneId: integer("milestone_id").references(() => deliveryMilestones.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  internalNotes: text("internal_notes"),
  status: deliveryDecisionStatus("status").default("open").notNull(),
  clientVisible: boolean("client_visible").default(true).notNull(),
  requestedFrom: text("requested_from"),
  targetDate: timestamp("target_date", { withTimezone: true }),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("delivery_decisions_project_status_idx").on(table.projectId, table.status),
  check("delivery_decisions_resolution_check", sql`(${table.status} = 'resolved' and ${table.resolvedAt} is not null and ${table.resolution} is not null) or (${table.status} <> 'resolved' and ${table.resolvedAt} is null)`),
])

export const deliveryProjectAuditLogs = pgTable("delivery_project_audit_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => deliveryProjects.id, { onDelete: "cascade" }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("delivery_project_audit_project_idx").on(table.projectId, table.createdAt)])

export const deliveryProjectProgress = pgView("delivery_project_progress", {
  projectId: integer("project_id").notNull(),
  progress: integer("progress").notNull(),
}).existing()

export const monthlyReports = pgTable("monthly_reports", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  htmlContent: text("html_content").notNull(),
  status: monthlyReportStatus("status").default("draft").notNull(),
  generatedBy: monthlyReportGeneratedBy("generated_by").default("forge").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, (table) => [
  index("monthly_reports_client_id_idx").on(table.clientId),
  index("monthly_reports_period_idx").on(table.clientId, table.year, table.month),
  index("monthly_reports_status_idx").on(table.status),
  index("monthly_reports_published_at_idx").on(table.publishedAt),
])

export const quoteRequests = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  business: text("business"),
  websiteUrl: text("website_url"),
  businessType: text("business_type"),
  projectType: text("project_type"),
  budget: text("budget"),
  launchTimeframe: text("launch_timeframe"),
  mainGoal: text("main_goal"),
  needs: text("needs"),
  carePlanInterest: text("care_plan_interest"),
  preferredContactMethod: text("preferred_contact_method"),
  enquiryIntent: text("enquiry_intent").default("quote").notNull(),
  leadSource: text("lead_source").default("public_quote").notNull(),
  funnelType: text("funnel_type").default("full_quote").notNull(),
  phone: text("phone"),
  consent: boolean("consent").default(false).notNull(),
  leadQuality: text("lead_quality").default("medium").notNull(),
  emailDeliveryStatus: text("email_delivery_status").default("pending").notNull(),
  emailFailureReason: text("email_failure_reason"),
  brief: text("brief").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  status: quoteStatus("status").default("new").notNull(),
})

export const loginRateLimits = pgTable("login_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  websiteUrl: text("website_url"),
  location: text("location"),
  industry: text("industry"),
  source: prospectSource("source").default("other").notNull(),
  stage: prospectStage("stage").default("found").notNull(),
  estimatedProjectValue: integer("estimated_project_value").default(0).notNull(),
  estimatedMonthlyRetainer: integer("estimated_monthly_retainer").default(0).notNull(),
  priority: prospectPriority("priority").default("medium").notNull(),
  revenueScore: integer("revenue_score").default(0).notNull(),
  trustScore: integer("trust_score").default(0).notNull(),
  conversionScore: integer("conversion_score").default(0).notNull(),
  seoScore: integer("seo_score").default(0).notNull(),
  mobileScore: integer("mobile_score").default(0).notNull(),
  auditSummary: text("audit_summary"),
  painPoints: text("pain_points"),
  opportunityNotes: text("opportunity_notes"),
  objectionNotes: text("objection_notes"),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  discoveryCallAt: timestamp("discovery_call_at", { withTimezone: true }),
  proposalSentAt: timestamp("proposal_sent_at", { withTimezone: true }),
  wonAt: timestamp("won_at", { withTimezone: true }),
  lostAt: timestamp("lost_at", { withTimezone: true }),
  lostReason: text("lost_reason"),
  convertedClientId: integer("converted_client_id").references(() => clients.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const prospectConversions = pgTable("prospect_conversions", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "restrict" }).notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "restrict" }).notNull(),
  projectId: integer("project_id").references(() => deliveryProjects.id, { onDelete: "set null" }),
  draftInvoiceId: integer("draft_invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  actorUserId: uuid("actor_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  clientAction: text("client_action").$type<"created" | "linked">().notNull(),
  assignedTier: text("assigned_tier"),
  portalProvisioningPrepared: boolean("portal_provisioning_prepared").default(false).notNull(),
  onboardingTaskIds: jsonb("onboarding_task_ids").$type<number[]>().default(sql`'[]'::jsonb`).notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
  convertedAt: timestamp("converted_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("prospect_conversions_prospect_idx").on(table.prospectId),
  index("prospect_conversions_client_idx").on(table.clientId, table.convertedAt),
])

export const deliveryOnboardingItems = pgTable("delivery_onboarding_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => deliveryProjects.id, { onDelete: "cascade" }).notNull(),
  milestoneId: integer("milestone_id").references(() => deliveryMilestones.id, { onDelete: "set null" }),
  kind: deliveryOnboardingItemKind("kind").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: deliveryOnboardingItemStatus("status").default("not_started").notNull(),
  clientVisible: boolean("client_visible").default(false).notNull(),
  ownerUserId: uuid("owner_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  blocker: text("blocker"),
  nextAction: text("next_action"),
  targetDate: timestamp("target_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("delivery_onboarding_items_project_position_idx").on(table.projectId, table.position),
  index("delivery_onboarding_items_project_status_idx").on(table.projectId, table.status),
  check("delivery_onboarding_items_position_check", sql`${table.position} >= 0`),
  check("delivery_onboarding_items_blocker_check", sql`${table.status} <> 'blocked' or ${table.blocker} is not null`),
  check("delivery_onboarding_items_completion_check", sql`(${table.status} = 'completed' and ${table.completedAt} is not null) or (${table.status} <> 'completed' and ${table.completedAt} is null)`),
])

export const clientServiceAssignments = pgTable("client_service_assignments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  catalogueItemId: integer("catalogue_item_id").references(() => invoiceCatalogueItems.id, { onDelete: "restrict" }).notNull(),
  sourceProspectId: integer("source_prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  assignedBy: uuid("assigned_by").references(() => adminUsers.id, { onDelete: "set null" }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("client_service_assignments_client_catalogue_idx").on(table.clientId, table.catalogueItemId),
  index("client_service_assignments_prospect_idx").on(table.sourceProspectId),
])

export const outreachActivities = pgTable("outreach_activities", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
  type: outreachActivityType("type").notNull(),
  direction: outreachDirection("direction").notNull(),
  subject: text("subject"),
  body: text("body"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by"),
})

export const proposalTrackings = pgTable("proposal_trackings", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
  packageType: proposalPackageType("package_type").default("custom").notNull(),
  quotedAmount: integer("quoted_amount").default(0).notNull(),
  monthlyRetainerAmount: integer("monthly_retainer_amount").default(0).notNull(),
  status: proposalStatus("status").default("draft").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const leadScoreSnapshots = pgTable("lead_score_snapshots", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
  score: integer("score").notNull(),
  confidence: text("confidence").notNull(),
  probabilityOfClosing: integer("probability_of_closing").notNull(),
  estimatedProjectValue: integer("estimated_project_value").default(0).notNull(),
  estimatedRetainerPotential: integer("estimated_retainer_potential").default(0).notNull(),
  recommendedNextAction: text("recommended_next_action").notNull(),
  positiveFactors: jsonb("positive_factors").$type<LeadScoreFactor[]>().default(sql`'[]'::jsonb`).notNull(),
  negativeFactors: jsonb("negative_factors").$type<LeadScoreFactor[]>().default(sql`'[]'::jsonb`).notNull(),
  neutralFactors: jsonb("neutral_factors").$type<LeadScoreFactor[]>().default(sql`'[]'::jsonb`).notNull(),
  missingInformation: jsonb("missing_information").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  affectedData: jsonb("affected_data").$type<LeadScoreResult["affectedData"]>().default(sql`'[]'::jsonb`).notNull(),
  modelVersion: text("model_version").notNull(),
  overrideScore: integer("override_score"),
  overrideReason: text("override_reason"),
  overrideBy: text("override_by"),
  overrideAt: timestamp("override_at", { withTimezone: true }),
  outcome: leadScoreOutcome("outcome"),
  outcomeValue: integer("outcome_value"),
  outcomeRetainer: integer("outcome_retainer"),
  outcomeNotes: text("outcome_notes"),
  outcomeRecordedAt: timestamp("outcome_recorded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("lead_score_snapshots_prospect_id_idx").on(table.prospectId, table.createdAt),
  index("lead_score_snapshots_score_idx").on(table.score),
  index("lead_score_snapshots_outcome_idx").on(table.outcome, table.outcomeRecordedAt),
])

export const salesProposals = pgTable("sales_proposals", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  htmlContent: text("html_content").notNull(),
  status: proposalStatus("status").default("draft").notNull(),
  generatedBy: salesProposalGeneratedBy("generated_by").default("forge").notNull(),
  selectedServices: text("selected_services"),
  buildPrice: integer("build_price").default(0).notNull(),
  retainerPrice: integer("retainer_price").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (table) => [
  index("sales_proposals_prospect_id_idx").on(table.prospectId),
  index("sales_proposals_client_id_idx").on(table.clientId),
  index("sales_proposals_status_idx").on(table.status),
  index("sales_proposals_updated_at_idx").on(table.updatedAt),
])

export const forgeProjects = pgTable("forge_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  businessName: text("business_name").notNull(),
  industry: text("industry"),
  websiteUrl: text("website_url"),
  status: forgeProjectStatus("status").default("intake").notNull(),
  priority: forgePriority("priority").default("medium").notNull(),
  ownerActor: text("owner_actor"),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  brandNotes: text("brand_notes"),
  targetAudience: text("target_audience"),
  primaryGoal: text("primary_goal"),
  budgetRange: text("budget_range"),
  deadline: timestamp("deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_projects_status_idx").on(table.status),
  index("forge_projects_priority_idx").on(table.priority),
  index("forge_projects_updated_at_idx").on(table.updatedAt),
])

export const forgeTasks = pgTable("forge_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  agentType: forgeTaskAgentType("agent_type").notNull(),
  status: forgeTaskStatus("status").default("queued").notNull(),
  resultQuality: forgeTaskResultQuality("result_quality").default("requires_review").notNull(),
  fallbackReason: text("fallback_reason"),
  providerAttempted: text("provider_attempted"),
  modelAttempted: text("model_attempted"),
  retryCount: integer("retry_count").default(0).notNull(),
  promptIdentifier: text("prompt_identifier").default("forge.legacy").notNull(),
  promptVersion: text("prompt_version").default("legacy").notNull(),
  schemaIdentifier: text("schema_identifier").default("forge.legacy").notNull(),
  schemaVersion: text("schema_version").default("legacy").notNull(),
  validationResult: jsonb("validation_result").$type<Record<string, unknown>>(),
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 }),
  downstreamAllowed: boolean("downstream_allowed").default(false).notNull(),
  humanApprovalRequired: boolean("human_approval_required").default(true).notNull(),
  publicationBlocked: boolean("publication_blocked").default(true).notNull(),
  qualityApprovedBy: text("quality_approved_by"),
  qualityApprovedAt: timestamp("quality_approved_at", { withTimezone: true }),
  qualityApprovalReason: text("quality_approval_reason"),
  inputJson: jsonb("input_json").$type<Record<string, unknown>>(),
  outputJson: jsonb("output_json").$type<Record<string, unknown>>(),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_tasks_project_id_idx").on(table.projectId),
  index("forge_tasks_project_status_idx").on(table.projectId, table.status),
  index("forge_tasks_project_agent_type_idx").on(table.projectId, table.agentType),
    index("forge_tasks_status_updated_at_idx").on(table.status, table.updatedAt),
    index("forge_tasks_project_result_quality_idx").on(table.projectId, table.resultQuality),
])

export const forgeArtifacts = pgTable("forge_artifacts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  type: forgeArtifactType("type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  version: integer("version").default(1).notNull(),
  parentArtifactId: integer("parent_artifact_id"),
  sourceTaskId: integer("source_task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
  provider: text("provider"),
  model: text("model"),
  promptIdentifier: text("prompt_identifier").default("forge.legacy").notNull(),
  promptVersion: text("prompt_version").default("unknown").notNull(),
  schemaIdentifier: text("schema_identifier").default("forge.legacy").notNull(),
  schemaVersion: text("schema_version").default("1").notNull(),
  sourceVersion: text("source_version"),
  upstreamArtifactIds: jsonb("upstream_artifact_ids").$type<number[]>().default([]).notNull(),
  upstreamArtifactHashes: jsonb("upstream_artifact_hashes").$type<Record<string, string>>().default({}).notNull(),
  inputContextHash: text("input_context_hash").default("pending").notNull(),
  outputHash: text("output_hash").default("pending").notNull(),
  actor: text("actor"),
  validationResult: jsonb("validation_result").$type<Record<string, unknown>>(),
  qualityState: forgeTaskResultQuality("quality_state").default("requires_review").notNull(),
  approvalState: text("approval_state").default("unapproved").notNull(),
  approvalHistory: jsonb("approval_history").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  retentionPolicy: text("retention_policy").default("standard").notNull(),
  contentBytes: integer("content_bytes").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_artifacts_project_id_idx").on(table.projectId),
  index("forge_artifacts_project_type_idx").on(table.projectId, table.type),
  index("forge_artifacts_project_type_title_idx").on(table.projectId, table.type, table.title),
  index("forge_artifacts_version_idx").on(table.projectId, table.type, table.title, table.version),
  index("forge_artifacts_parent_idx").on(table.parentArtifactId),
  index("forge_artifacts_source_task_idx").on(table.sourceTaskId),
])

export const forgeDeploymentCandidateState = pgEnum("forge_deployment_candidate_state", DEPLOYMENT_CANDIDATE_STATES)

export const forgeDeploymentCandidates = pgTable("forge_deployment_candidates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  candidateNumber: integer("candidate_number").notNull(),
  parentCandidateId: integer("parent_candidate_id"),
  state: forgeDeploymentCandidateState("state").default("draft").notNull(),
  workspaceVersion: text("workspace_version").notNull(),
  workspacePath: text("workspace_path").notNull(),
  workspaceHash: text("workspace_hash").notNull(),
  repositoryCommit: text("repository_commit"),
  approvedArtifactsJson: jsonb("approved_artifacts_json").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull(),
  dependencyReportJson: jsonb("dependency_report_json").$type<ForgeDependencyAdmissionReport>(),
  dependencyReportHash: text("dependency_report_hash"),
  dependencySbomJson: jsonb("dependency_sbom_json").$type<Record<string, unknown>>(),
  dependencySbomHash: text("dependency_sbom_hash"),
  dependencyPackageJsonHash: text("dependency_package_json_hash"),
  dependencyLockfileHash: text("dependency_lockfile_hash"),
  dependencyPolicyVersion: text("dependency_policy_version"),
  dependencyEvidenceCreatedAt: timestamp("dependency_evidence_created_at", { withTimezone: true }),
  fallbackDependenciesJson: jsonb("fallback_dependencies_json").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  environmentRequirementsJson: jsonb("environment_requirements_json").$type<string[]>().default([]).notNull(),
  migrationRequirementsJson: jsonb("migration_requirements_json").$type<string[]>().default([]).notNull(),
  releaseNotes: text("release_notes").notNull(),
  rollbackPlan: text("rollback_plan").notNull(),
  createdBy: text("created_by").notNull(),
  submittedBy: text("submitted_by"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvalReason: text("approval_reason"),
  rejectedBy: text("rejected_by"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("forge_deployment_candidates_project_number_idx").on(table.projectId, table.candidateNumber),
  index("forge_deployment_candidates_project_state_idx").on(table.projectId, table.state),
  index("forge_deployment_candidates_parent_idx").on(table.parentCandidateId),
])

export const forgeReleaseGateDecisionKind = pgEnum("forge_release_gate_decision_kind", ["approved", "override", "revoked"])

export const forgeReleaseGateDecisions = pgTable("forge_release_gate_decisions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  candidateId: integer("candidate_id").references(() => forgeDeploymentCandidates.id, { onDelete: "cascade" }).notNull(),
  candidateWorkspaceHash: text("candidate_workspace_hash").notNull(),
  gateKey: text("gate_key").notNull(),
  decision: forgeReleaseGateDecisionKind("decision").notNull(),
  actorId: text("actor_id").notNull(),
  actorRole: text("actor_role").notNull(),
  reason: text("reason").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("forge_release_gate_decisions_candidate_gate_idx").on(table.candidateId, table.gateKey),
  index("forge_release_gate_decisions_project_idx").on(table.projectId, table.candidateId),
])

export const projectEstimateSnapshots = pgTable("project_estimate_snapshots", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  estimatedHours: integer("estimated_hours").notNull(),
  confidence: text("confidence").notNull(),
  confidenceRange: jsonb("confidence_range").$type<ProjectEstimateResult["confidenceRange"]>().notNull(),
  complexityRating: projectEstimateComplexity("complexity_rating").notNull(),
  riskFactors: jsonb("risk_factors").$type<ProjectEstimateResult["riskFactors"]>().default(sql`'[]'::jsonb`).notNull(),
  suggestedBuildPrice: integer("suggested_build_price").notNull(),
  suggestedRetainer: integer("suggested_retainer").notNull(),
  minimumViableScope: jsonb("minimum_viable_scope").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  optionalEnhancements: jsonb("optional_enhancements").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  estimatedDeliveryRange: jsonb("estimated_delivery_range").$type<ProjectEstimateResult["estimatedDeliveryRange"]>().notNull(),
  marginEstimate: jsonb("margin_estimate").$type<ProjectEstimateResult["marginEstimate"]>().notNull(),
  knownInputs: jsonb("known_inputs").$type<ProjectEstimateResult["knownInputs"]>().default(sql`'[]'::jsonb`).notNull(),
  assumptions: jsonb("assumptions").$type<ProjectEstimateResult["assumptions"]>().default(sql`'[]'::jsonb`).notNull(),
  underpricingRisks: jsonb("underpricing_risks").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  disclaimer: text("disclaimer").notNull(),
  modelVersion: text("model_version").notNull(),
  manualHours: integer("manual_hours"),
  manualBuildPrice: integer("manual_build_price"),
  manualRetainer: integer("manual_retainer"),
  manualReason: text("manual_reason"),
  manualBy: text("manual_by"),
  manualAt: timestamp("manual_at", { withTimezone: true }),
  actualHours: integer("actual_hours"),
  actualBuildPrice: integer("actual_build_price"),
  actualRetainer: integer("actual_retainer"),
  actualNotes: text("actual_notes"),
  actualRecordedAt: timestamp("actual_recorded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("project_estimate_snapshots_project_id_idx").on(table.projectId, table.createdAt),
  index("project_estimate_snapshots_complexity_idx").on(table.complexityRating),
])

export const deliveryCapacityAdjustments = pgTable("delivery_capacity_adjustments", {
  id: serial("id").primaryKey(),
  weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
  adjustmentType: deliveryCapacityAdjustmentType("adjustment_type").notNull(),
  staffName: text("staff_name"),
  role: text("role"),
  hours: integer("hours").notNull(),
  reason: text("reason").notNull(),
  confidence: text("confidence").default("medium").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("delivery_capacity_adjustments_week_idx").on(table.weekStart),
  index("delivery_capacity_adjustments_type_idx").on(table.adjustmentType, table.weekStart),
])

export const deliveryForecastActuals = pgTable("delivery_forecast_actuals", {
  id: serial("id").primaryKey(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodType: text("period_type").default("week").notNull(),
  forecastHours: integer("forecast_hours").notNull(),
  actualHours: integer("actual_hours").notNull(),
  notes: text("notes"),
  recordedBy: text("recorded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("delivery_forecast_actuals_period_idx").on(table.periodType, table.periodStart),
])

export const operatingBriefActions = pgTable("operating_brief_actions", {
  id: serial("id").primaryKey(),
  recommendationKey: text("recommendation_key").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  status: operatingBriefActionStatus("status").notNull(),
  reason: text("reason"),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("operating_brief_actions_key_idx").on(table.recommendationKey, table.evidenceHash),
  index("operating_brief_actions_status_idx").on(table.status, table.snoozedUntil),
])

export const clientAnalyticsConfigs = pgTable("client_analytics_configs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  provider: analyticsProvider("provider").notNull(),
  displayName: text("display_name").notNull(),
  propertyId: text("property_id"),
  consentGranted: boolean("consent_granted").default(false).notNull(),
  consentNotes: text("consent_notes"),
  retentionDays: integer("retention_days").default(395).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  credentialsEncrypted: text("credentials_encrypted"),
  scopes: jsonb("scopes").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  sourceAttribution: text("source_attribution").notNull(),
  lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true }),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("client_analytics_configs_client_idx").on(table.clientId),
  index("client_analytics_configs_provider_idx").on(table.provider, table.enabled),
])

export const clientAnalyticsDailyMetrics = pgTable("client_analytics_daily_metrics", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  configId: integer("config_id").references(() => clientAnalyticsConfigs.id, { onDelete: "set null" }),
  metricDate: timestamp("metric_date", { withTimezone: true }).notNull(),
  source: analyticsMetricSource("source").notNull(),
  sourceAttribution: text("source_attribution").notNull(),
  sessions: integer("sessions"),
  conversionEvents: integer("conversion_events"),
  formSubmissions: integer("form_submissions"),
  phoneClicks: integer("phone_clicks"),
  ctaClicks: integer("cta_clicks"),
  searchImpressions: integer("search_impressions"),
  searchClicks: integer("search_clicks"),
  errorCount: integer("error_count"),
  uptimeChecks: integer("uptime_checks"),
  uptimeFailures: integer("uptime_failures"),
  lcpP75Ms: integer("lcp_p75_ms"),
  inpP75Ms: integer("inp_p75_ms"),
  clsP75: numeric("cls_p75", { precision: 6, scale: 4 }),
  rawSummary: jsonb("raw_summary").$type<Record<string, unknown>>().default({}).notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("client_analytics_daily_client_date_idx").on(table.clientId, table.metricDate),
  index("client_analytics_daily_source_idx").on(table.source, table.metricDate),
])

export const clientAnalyticsAuditLogs = pgTable("client_analytics_audit_logs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  configId: integer("config_id").references(() => clientAnalyticsConfigs.id, { onDelete: "set null" }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  message: text("message").notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("client_analytics_audit_client_idx").on(table.clientId, table.createdAt),
  index("client_analytics_audit_config_idx").on(table.configId, table.createdAt),
])

export const clientOptimisationProposals = pgTable("client_optimisation_proposals", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  proposalKey: text("proposal_key").notNull(),
  status: optimisationProposalStatus("status").default("proposed").notNull(),
  title: text("title").notNull(),
  evidenceJson: jsonb("evidence_json").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  expectedImpact: text("expected_impact").notNull(),
  confidence: text("confidence").notNull(),
  estimatedEffort: text("estimated_effort").notNull(),
  risk: text("risk").notNull(),
  proposedChange: text("proposed_change").notNull(),
  validationMethod: text("validation_method").notNull(),
  rollbackPlan: text("rollback_plan").notNull(),
  requiredApproval: text("required_approval").notNull(),
  relevantPages: jsonb("relevant_pages").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  relevantArtifacts: jsonb("relevant_artifacts").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  targetMetric: text("target_metric").notNull(),
  baselineValue: numeric("baseline_value", { precision: 12, scale: 4 }),
  measuredValue: numeric("measured_value", { precision: 12, scale: 4 }),
  improved: boolean("improved"),
  outcomeNotes: text("outcome_notes"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  measuredAt: timestamp("measured_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("client_optimisation_proposals_client_idx").on(table.clientId, table.status),
  uniqueIndex("client_optimisation_proposals_key_idx").on(table.clientId, table.proposalKey),
])

export const experienceEvents = pgTable("experience_events", {
  id: serial("id").primaryKey(),
  eventName: experienceEventName("event_name").notNull(),
  eventKey: text("event_key").notNull(),
  sessionId: text("session_id").notNull(),
  path: text("path").notNull(),
  deviceClass: experienceDeviceClass("device_class").default("unknown").notNull(),
  preference: experiencePreference("preference").default("unknown").notNull(),
  returningPreference: boolean("returning_preference").default(false).notNull(),
  fromExperience: experiencePreference("from_experience"),
  toExperience: experiencePreference("to_experience"),
  interactiveStep: text("interactive_step"),
  completionDepth: integer("completion_depth"),
  referrerHost: text("referrer_host"),
  campaignSource: text("campaign_source"),
  campaignMedium: text("campaign_medium"),
  campaignName: text("campaign_name"),
  errorCategory: text("error_category"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("experience_events_event_key_idx").on(table.eventKey),
  index("experience_events_name_time_idx").on(table.eventName, table.occurredAt),
  index("experience_events_preference_time_idx").on(table.preference, table.occurredAt),
  index("experience_events_session_idx").on(table.sessionId),
])

export const forgeIntegrationConfigs = pgTable("forge_integration_configs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  provider: forgeIntegrationProvider("provider").notNull(),
  configJson: jsonb("config_json").$type<Record<string, unknown>>(),
  enabled: boolean("enabled").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_integration_configs_project_id_idx").on(table.projectId),
  index("forge_integration_configs_project_provider_idx").on(table.projectId, table.provider),
  index("forge_integration_configs_provider_idx").on(table.provider),
])

export const forgeActivityLogs = pgTable("forge_activity_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  actor: text("actor"),
  action: text("action").notNull(),
  message: text("message").notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_activity_logs_project_id_idx").on(table.projectId),
  index("forge_activity_logs_project_created_at_idx").on(table.projectId, table.createdAt),
  index("forge_activity_logs_action_idx").on(table.action),
])

export const forgeMemories = pgTable("forge_memories", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_memories_project_id_idx").on(table.projectId),
  index("forge_memories_project_key_idx").on(table.projectId, table.key),
])

export const forgeClarificationQuestions = pgTable("forge_clarification_questions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  taskId: integer("task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
  artifactId: integer("artifact_id").references(() => forgeArtifacts.id, { onDelete: "set null" }),
  factKey: text("fact_key").notNull(),
  question: text("question").notNull(),
  category: text("category").notNull(),
  urgency: text("urgency").default("medium").notNull(),
  assignee: text("assignee"),
  status: text("status").default("open").notNull(),
  groupKey: text("group_key").notNull(),
  duplicateKey: text("duplicate_key").notNull(),
  evidenceJson: jsonb("evidence_json").$type<string[]>().default([]).notNull(),
  sourceType: text("source_type").notNull(),
  sourceDetail: text("source_detail"),
  answer: text("answer"),
  answeredBy: text("answered_by"),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revalidateAfter: timestamp("revalidate_after", { withTimezone: true }),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("forge_clarification_questions_project_duplicate_idx").on(table.projectId, table.duplicateKey),
  index("forge_clarification_questions_project_status_idx").on(table.projectId, table.status),
  index("forge_clarification_questions_task_idx").on(table.taskId),
  index("forge_clarification_questions_fact_key_idx").on(table.projectId, table.factKey),
])

export const forgeProjectFacts = pgTable("forge_project_facts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  category: text("category").notNull(),
  sourceType: text("source_type").notNull(),
  sourceQuestionId: integer("source_question_id").references(() => forgeClarificationQuestions.id, { onDelete: "set null" }),
  sourceArtifactId: integer("source_artifact_id").references(() => forgeArtifacts.id, { onDelete: "set null" }),
  sourceTaskId: integer("source_task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
  answeredBy: text("answered_by"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revalidateAfter: timestamp("revalidate_after", { withTimezone: true }),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  provenanceJson: jsonb("provenance_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("forge_project_facts_project_key_idx").on(table.projectId, table.key),
  index("forge_project_facts_project_category_idx").on(table.projectId, table.category),
  index("forge_project_facts_revalidate_idx").on(table.revalidateAfter),
])

// Lightweight job queue for long-running Forge actions. The API enqueues a row and returns
// quickly; the worker (in-process by default, or a drained queue) executes the handler, which
// updates the detailed forgeTasks/forgeArtifacts/forgeActivityLogs records. `kind` and `status`
// are text (validated in app code) to avoid enum migrations as new job kinds are added.
// Durable job states. `dead_letter` holds jobs that exhausted their retries; it
// is a text column (not an enum) so adding states needs no enum migration.
export const forgeJobs = pgTable("forge_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  taskId: integer("task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  status: text("status").default("queued").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
  error: text("error"),
  failureReason: text("failure_reason"),
  operatorErrorJson: jsonb("operator_error_json").$type<ForgeOperatorError>(),
  actor: text("actor"),
  idempotencyKey: text("idempotency_key"),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  // Lease coordination: only the worker that holds an unexpired lease may run a
  // job; an expired lease is reclaimable by any worker.
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_jobs_project_id_idx").on(table.projectId),
  index("forge_jobs_status_created_at_idx").on(table.status, table.createdAt),
  index("forge_jobs_status_scheduled_at_idx").on(table.status, table.scheduledAt),
  index("forge_jobs_lease_expires_at_idx").on(table.leaseExpiresAt),
  uniqueIndex("forge_jobs_idempotency_key_key").on(table.idempotencyKey),
])

export const forgeRuns = pgTable("forge_runs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  mode: text("mode").default("standard").notNull(),
  status: text("status").default("draft").notNull(),
  currentStage: text("current_stage"),
  policyJson: jsonb("policy_json").$type<ForgeRunPolicy>().default({}).notNull(),
  startedBy: text("started_by").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  pauseReason: text("pause_reason"),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }).default("0").notNull(),
  actualCostUsd: numeric("actual_cost_usd", { precision: 12, scale: 6 }).default("0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_runs_project_created_at_idx").on(table.projectId, table.createdAt),
  index("forge_runs_project_status_idx").on(table.projectId, table.status),
  index("forge_runs_status_updated_at_idx").on(table.status, table.updatedAt),
  uniqueIndex("forge_runs_one_active_project_idx").on(table.projectId).where(sql`${table.status} in ('draft','running','paused')`),
])

export const forgeRunSteps = pgTable("forge_run_steps", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => forgeRuns.id, { onDelete: "cascade" }).notNull(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  stage: text("stage").notNull(),
  status: text("status").default("pending").notNull(),
  sequence: integer("sequence").notNull(),
  required: boolean("required").default(true).notNull(),
  inputHash: text("input_hash"),
  outputArtifactIds: jsonb("output_artifact_ids").$type<number[]>().default([]).notNull(),
  jobId: integer("job_id").references(() => forgeJobs.id, { onDelete: "set null" }),
  taskId: integer("task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
  attemptCount: integer("attempt_count").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }).default("0").notNull(),
  actualCostUsd: numeric("actual_cost_usd", { precision: 12, scale: 6 }).default("0").notNull(),
  estimatedRetryCostUsd: numeric("estimated_retry_cost_usd", { precision: 12, scale: 6 }).default("0").notNull(),
  remainingEstimatedCostUsd: numeric("remaining_estimated_cost_usd", { precision: 12, scale: 6 }).default("0").notNull(),
  approvalRequired: boolean("approval_required").default(false).notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  failureCategory: text("failure_category"),
  failureMessage: text("failure_message"),
  operatorErrorJson: jsonb("operator_error_json").$type<ForgeOperatorError>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("forge_run_steps_run_stage_idx").on(table.runId, table.stage),
  uniqueIndex("forge_run_steps_job_idx").on(table.jobId),
  index("forge_run_steps_run_sequence_idx").on(table.runId, table.sequence),
  index("forge_run_steps_project_status_idx").on(table.projectId, table.status),
])

export const forgeRunEvents = pgTable("forge_run_events", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => forgeRuns.id, { onDelete: "cascade" }).notNull(),
  stepId: integer("step_id").references(() => forgeRunSteps.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  message: text("message").notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_run_events_run_created_at_idx").on(table.runId, table.createdAt),
  index("forge_run_events_step_created_at_idx").on(table.stepId, table.createdAt),
  index("forge_run_events_type_idx").on(table.eventType),
])

export const forgeWorkerHeartbeats = pgTable("forge_worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  processId: integer("process_id").notNull(),
  hostname: text("hostname").notNull(),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }).defaultNow().notNull(),
  activeJobCount: integer("active_job_count").default(0).notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
}, (table) => [
  index("forge_worker_heartbeats_last_seen_idx").on(table.lastHeartbeatAt),
])

// Durable shared rate-limit counters (fixed window). Incremented atomically via
// INSERT ... ON CONFLICT DO UPDATE so counts are consistent across replicas.
export const rateLimitCounters = pgTable("rate_limit_counters", {
  key: text("key").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.key, table.windowStart] }),
  index("rate_limit_counters_expires_at_idx").on(table.expiresAt),
])

// Durable preview ownership + lifecycle. One row per project; `owner` names the
// admin instance that holds the live process/container so restarts and other
// replicas can reconcile abandoned previews.
export const forgePreviews = pgTable("forge_previews", {
  projectId: integer("project_id").primaryKey().references(() => forgeProjects.id, { onDelete: "cascade" }),
  status: text("status").default("stopped").notNull(),
  owner: text("owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
  method: text("method"),
  url: text("url"),
  host: text("host"),
  port: integer("port"),
  pid: integer("pid"),
  containerId: text("container_id"),
  workspacePath: text("workspace_path"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  error: text("error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_previews_lease_expires_at_idx").on(table.leaseExpiresAt),
])

// Internal-only adapter state. Portal schema deliberately has no mapping for this table.
export const deliveryForgeIntegrations = pgTable("delivery_forge_integrations", {
  projectId: integer("project_id").primaryKey().references(() => deliveryProjects.id, { onDelete: "cascade" }),
  forgeProjectId: integer("forge_project_id").references(() => forgeProjects.id, { onDelete: "restrict" }).notNull(),
  latestRunId: integer("latest_run_id").references(() => forgeRuns.id, { onDelete: "set null" }),
  deploymentCandidateId: integer("deployment_candidate_id").references(() => forgeDeploymentCandidates.id, { onDelete: "set null" }),
  internalReleaseId: text("internal_release_id"),
  stagingDeploymentId: text("staging_deployment_id"),
  productionDeploymentId: text("production_deployment_id"),
  internalBuildStatus: text("internal_build_status"),
  internalQaStatus: text("internal_qa_status"),
  internalDeploymentStatus: text("internal_deployment_status"),
  lastInternalEventAt: timestamp("last_internal_event_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("delivery_forge_integrations_forge_project_idx").on(table.forgeProjectId),
  index("delivery_forge_integrations_run_idx").on(table.latestRunId),
  index("delivery_forge_integrations_candidate_idx").on(table.deploymentCandidateId),
])

export const forgeAiUsage = pgTable("forge_ai_usage", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
  runId: integer("run_id").references(() => forgeRuns.id, { onDelete: "set null" }),
  runStepId: integer("run_step_id").references(() => forgeRunSteps.id, { onDelete: "set null" }),
  jobId: integer("job_id").references(() => forgeJobs.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").default(0).notNull(),
  completionTokens: integer("completion_tokens").default(0).notNull(),
  totalTokens: integer("total_tokens").default(0).notNull(),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 6 }).default("0").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("forge_ai_usage_project_id_idx").on(table.projectId),
  index("forge_ai_usage_task_id_idx").on(table.taskId),
  index("forge_ai_usage_run_id_idx").on(table.runId),
  index("forge_ai_usage_run_step_id_idx").on(table.runStepId),
  index("forge_ai_usage_job_id_idx").on(table.jobId),
  index("forge_ai_usage_completed_at_idx").on(table.completedAt),
  index("forge_ai_usage_provider_idx").on(table.provider),
  index("forge_ai_usage_project_completed_at_idx").on(table.projectId, table.completedAt),
])

export const forgeAiBudgetReservations = pgTable("forge_ai_budget_reservations", {
  id: serial("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "set null" }),
  taskId: integer("task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  status: text("status").default("reserved").notNull(),
  reservedCost: numeric("reserved_cost", { precision: 12, scale: 6 }).notNull(),
  actualCost: numeric("actual_cost", { precision: 12, scale: 6 }),
  usageKnown: boolean("usage_known").default(false).notNull(),
  fallbackProvider: text("fallback_provider"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  failureCategory: text("failure_category"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("forge_ai_budget_reservations_idempotency_idx").on(table.idempotencyKey),
  index("forge_ai_budget_reservations_status_expiry_idx").on(table.status, table.expiresAt),
  index("forge_ai_budget_reservations_project_idx").on(table.projectId, table.createdAt),
  index("forge_ai_budget_reservations_provider_idx").on(table.provider, table.createdAt),
])

export const forgeProviderHealth = pgTable("forge_provider_health", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  event: text("event").notNull(),
  fromState: text("from_state"),
  toState: text("to_state"),
  category: text("category"),
  detail: text("detail"),
  model: text("model"),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "set null" }),
  taskId: integer("task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_provider_health_provider_idx").on(table.provider),
  index("forge_provider_health_created_at_idx").on(table.createdAt),
])

export const clientRelations = relations(clients, ({ many }) => ({
  kanbanCards: many(kanbanCards),
  messages: many(messages),
  convertedProspects: many(prospects),
  forgeProjects: many(forgeProjects),
  salesProposals: many(salesProposals),
}))

export const kanbanCardRelations = relations(kanbanCards, ({ one }) => ({
  client: one(clients, {
    fields: [kanbanCards.clientId],
    references: [clients.id],
  }),
}))

export const messageRelations = relations(messages, ({ one }) => ({
  client: one(clients, {
    fields: [messages.clientId],
    references: [clients.id],
  }),
}))

export const prospectRelations = relations(prospects, ({ many, one }) => ({
  outreachActivities: many(outreachActivities),
  proposals: many(proposalTrackings),
  salesProposals: many(salesProposals),
  leadScoreSnapshots: many(leadScoreSnapshots),
  forgeProjects: many(forgeProjects),
  convertedClient: one(clients, {
    fields: [prospects.convertedClientId],
    references: [clients.id],
  }),
}))

export const outreachActivityRelations = relations(outreachActivities, ({ one }) => ({
  prospect: one(prospects, {
    fields: [outreachActivities.prospectId],
    references: [prospects.id],
  }),
}))

export const proposalTrackingRelations = relations(proposalTrackings, ({ one }) => ({
  prospect: one(prospects, {
    fields: [proposalTrackings.prospectId],
    references: [prospects.id],
  }),
}))

export const leadScoreSnapshotRelations = relations(leadScoreSnapshots, ({ one }) => ({
  prospect: one(prospects, {
    fields: [leadScoreSnapshots.prospectId],
    references: [prospects.id],
  }),
}))

export const salesProposalRelations = relations(salesProposals, ({ one }) => ({
  prospect: one(prospects, {
    fields: [salesProposals.prospectId],
    references: [prospects.id],
  }),
  client: one(clients, {
    fields: [salesProposals.clientId],
    references: [clients.id],
  }),
}))

export const forgeProjectRelations = relations(forgeProjects, ({ many, one }) => ({
  client: one(clients, {
    fields: [forgeProjects.clientId],
    references: [clients.id],
  }),
  prospect: one(prospects, {
    fields: [forgeProjects.prospectId],
    references: [prospects.id],
  }),
  tasks: many(forgeTasks),
  artifacts: many(forgeArtifacts),
  estimateSnapshots: many(projectEstimateSnapshots),
  integrationConfigs: many(forgeIntegrationConfigs),
  activityLogs: many(forgeActivityLogs),
  memories: many(forgeMemories),
  jobs: many(forgeJobs),
  aiUsage: many(forgeAiUsage),
  runs: many(forgeRuns),
}))

export const forgeTaskRelations = relations(forgeTasks, ({ many, one }) => ({
  project: one(forgeProjects, {
    fields: [forgeTasks.projectId],
    references: [forgeProjects.id],
  }),
  aiUsage: many(forgeAiUsage),
}))

export const forgeJobRelations = relations(forgeJobs, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [forgeJobs.projectId],
    references: [forgeProjects.id],
  }),
  runStep: one(forgeRunSteps, {
    fields: [forgeJobs.id],
    references: [forgeRunSteps.jobId],
  }),
}))

export const forgeRunRelations = relations(forgeRuns, ({ many, one }) => ({
  project: one(forgeProjects, {
    fields: [forgeRuns.projectId],
    references: [forgeProjects.id],
  }),
  steps: many(forgeRunSteps),
  events: many(forgeRunEvents),
}))

export const forgeRunStepRelations = relations(forgeRunSteps, ({ many, one }) => ({
  run: one(forgeRuns, {
    fields: [forgeRunSteps.runId],
    references: [forgeRuns.id],
  }),
  project: one(forgeProjects, {
    fields: [forgeRunSteps.projectId],
    references: [forgeProjects.id],
  }),
  job: one(forgeJobs, {
    fields: [forgeRunSteps.jobId],
    references: [forgeJobs.id],
  }),
  task: one(forgeTasks, {
    fields: [forgeRunSteps.taskId],
    references: [forgeTasks.id],
  }),
  events: many(forgeRunEvents),
}))

export const forgeRunEventRelations = relations(forgeRunEvents, ({ one }) => ({
  run: one(forgeRuns, {
    fields: [forgeRunEvents.runId],
    references: [forgeRuns.id],
  }),
  step: one(forgeRunSteps, {
    fields: [forgeRunEvents.stepId],
    references: [forgeRunSteps.id],
  }),
}))

export const forgeAiUsageRelations = relations(forgeAiUsage, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [forgeAiUsage.projectId],
    references: [forgeProjects.id],
  }),
  task: one(forgeTasks, {
    fields: [forgeAiUsage.taskId],
    references: [forgeTasks.id],
  }),
  run: one(forgeRuns, {
    fields: [forgeAiUsage.runId],
    references: [forgeRuns.id],
  }),
  runStep: one(forgeRunSteps, {
    fields: [forgeAiUsage.runStepId],
    references: [forgeRunSteps.id],
  }),
  job: one(forgeJobs, {
    fields: [forgeAiUsage.jobId],
    references: [forgeJobs.id],
  }),
}))

export const forgeArtifactRelations = relations(forgeArtifacts, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [forgeArtifacts.projectId],
    references: [forgeProjects.id],
  }),
}))

export const projectEstimateSnapshotRelations = relations(projectEstimateSnapshots, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [projectEstimateSnapshots.projectId],
    references: [forgeProjects.id],
  }),
}))

export const forgeIntegrationConfigRelations = relations(forgeIntegrationConfigs, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [forgeIntegrationConfigs.projectId],
    references: [forgeProjects.id],
  }),
}))

export const forgeActivityLogRelations = relations(forgeActivityLogs, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [forgeActivityLogs.projectId],
    references: [forgeProjects.id],
  }),
}))

export const forgeMemoryRelations = relations(forgeMemories, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [forgeMemories.projectId],
    references: [forgeProjects.id],
  }),
}))
