import { boolean, customType, index, integer, jsonb, pgEnum, pgTable, pgView, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" })

export const quoteStatus = pgEnum("quote_status", ["new", "read", "replied", "reviewed", "contacted", "qualified", "won", "lost"])
export const invoiceStatus = pgEnum("invoice_status", ["draft", "issued", "paid", "void"])
export const invoicePortalAccessType = pgEnum("invoice_portal_access_type", ["view", "download"])
export const clientRequestCategory = pgEnum("client_request_category", [
  "website_update",
  "website_issue",
  "form_issue",
  "seo_request",
  "new_page",
  "content_assets",
  "urgent_support",
  "general_support",
])
export const clientRequestPriority = pgEnum("client_request_priority", ["low", "medium", "high", "critical"])
export const clientRequestStatus = pgEnum("client_request_status", ["new", "triaged", "in_progress", "waiting_client", "completed", "cancelled"])
export const requestMessageSenderType = pgEnum("request_message_sender_type", ["client", "admin", "system"])
export const requestMessageVisibility = pgEnum("request_message_visibility", ["client_visible", "internal"])
export const monthlyReportStatus = pgEnum("monthly_report_status", ["draft", "published"])
export const monthlyReportGeneratedBy = pgEnum("monthly_report_generated_by", ["forge", "manual"])
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
  "web_vital",
  "local_growth_check_viewed",
  "local_growth_check_form_started",
  "local_growth_check_form_submitted",
  "local_growth_check_full_quote_selected",
  "local_growth_check_strategy_call_requested",
])
export const experienceDeviceClass = pgEnum("experience_device_class", ["mobile", "tablet", "desktop", "unknown"])
export const experiencePreference = pgEnum("experience_preference", ["normal", "interactive", "none", "unknown"])

export const publicVerifiedClaims = pgView("public_verified_claims", {
  id: text("id").notNull(),
  approvedWording: text("approved_wording").notNull(),
  claimType: text("claim_type").notNull(),
  attributionName: text("attribution_name"),
  attributionBusiness: text("attribution_business"),
  permittedRoutes: text("permitted_routes").array().notNull(),
  permittedComponents: text("permitted_components").array().notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  reviewExpiresAt: timestamp("review_expires_at", { withTimezone: true }).notNull(),
}).existing()

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

export const portalClientAccounts = pgTable("portal_client_accounts", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

// Admin owns these shared invoice tables and their migrations. The web portal has
// an intentionally narrow read/telemetry projection only.
export const invoicePortalClients = pgTable("clients", {
  id: serial("id").primaryKey(),
  portalClientId: text("portal_client_id"),
})
export const portalInvoices = pgTable("invoices", {
  id: serial("id").primaryKey(), invoiceNumber: text("invoice_number"), clientId: integer("client_id").notNull(),
  clientNameSnapshot: text("client_name_snapshot").notNull(), billingContactNameSnapshot: text("billing_contact_name_snapshot"),
  billingEmailSnapshot: text("billing_email_snapshot"), billingAddressLine1Snapshot: text("billing_address_line_1_snapshot"),
  billingAddressLine2Snapshot: text("billing_address_line_2_snapshot"), billingCitySnapshot: text("billing_city_snapshot"),
  billingCountySnapshot: text("billing_county_snapshot"), billingPostcodeSnapshot: text("billing_postcode_snapshot"),
  billingCountrySnapshot: text("billing_country_snapshot"), currency: text("currency").notNull(),
  invoiceDate: timestamp("invoice_date", { withTimezone: true }).notNull(), dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  status: invoiceStatus("status").notNull(), subtotal: integer("subtotal").notNull(), total: integer("total").notNull(),
  customerNotes: text("customer_notes"), issuedAt: timestamp("issued_at", { withTimezone: true }), paidAt: timestamp("paid_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }), documentTemplateVersion: text("document_template_version"),
  supplierSnapshot: jsonb("supplier_snapshot").$type<Record<string, string | null>>(), paymentSnapshot: jsonb("payment_snapshot").$type<Record<string, string | null>>(),
  documentPdf: bytea("document_pdf"), documentPdfSha256: text("document_pdf_sha256"),
  portalPublishedAt: timestamp("portal_published_at", { withTimezone: true }),
})
export const portalInvoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(), invoiceId: integer("invoice_id").notNull(), title: text("title").notNull(),
  description: text("description"), quantity: integer("quantity").notNull(), unitAmount: integer("unit_amount").notNull(),
  lineAmount: integer("line_amount").notNull(), position: integer("position").notNull(),
})
export const invoicePortalAccessEvents = pgTable("invoice_portal_access_events", {
  id: serial("id").primaryKey(), invoiceId: integer("invoice_id").notNull(), portalClientId: text("portal_client_id").notNull(),
  accessType: invoicePortalAccessType("access_type").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
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
}, (table) => [
  index("client_request_messages_request_id_idx").on(table.requestId),
  index("client_request_messages_visibility_idx").on(table.visibility),
  index("client_request_messages_created_at_idx").on(table.createdAt),
])

export const clientTimelineEvents = pgTable("client_timeline_events", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  requestId: integer("request_id").references(() => clientRequests.id, { onDelete: "cascade" }),
  projectId: integer("project_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  visibility: requestMessageVisibility("visibility").default("client_visible").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("client_timeline_events_client_id_idx").on(table.clientId),
  index("client_timeline_events_request_id_idx").on(table.requestId),
  index("client_timeline_events_project_id_idx").on(table.projectId),
  index("client_timeline_events_visibility_idx").on(table.visibility),
  index("client_timeline_events_created_at_idx").on(table.createdAt),
])

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

export const quoteRateLimits = pgTable("quote_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const loginRateLimits = pgTable("login_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})
