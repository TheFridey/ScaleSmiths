import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const quoteStatus = pgEnum("quote_status", ["new", "read", "replied", "reviewed", "contacted", "qualified", "won", "lost"])
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
