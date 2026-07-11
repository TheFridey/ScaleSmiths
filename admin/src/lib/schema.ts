import { relations, sql } from "drizzle-orm"
import { boolean, index, integer, jsonb, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

export const kanbanColumn = pgEnum("kanban_column", ["backlog", "progress", "review", "done"])
export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"])
export const quoteStatus = pgEnum("quote_status", ["new", "read", "replied", "reviewed", "contacted", "qualified", "won", "lost"])
export const prospectSource = pgEnum("prospect_source", ["linkedin", "email", "facebook", "local", "referral", "inbound", "other"])
export const prospectStage = pgEnum("prospect_stage", ["found", "audited", "contacted", "replied", "discovery_booked", "proposal_sent", "follow_up_due", "won", "lost"])
export const prospectPriority = pgEnum("prospect_priority", ["low", "medium", "high"])
export const outreachActivityType = pgEnum("outreach_activity_type", ["linkedin_message", "email", "phone_call", "facebook_message", "in_person", "follow_up", "proposal", "note"])
export const outreachDirection = pgEnum("outreach_direction", ["outbound", "inbound", "internal"])
export const proposalPackageType = pgEnum("proposal_package_type", ["foundation", "growth", "forge", "retainer", "custom"])
export const proposalStatus = pgEnum("proposal_status", ["draft", "sent", "viewed", "follow_up_due", "accepted", "rejected"])
export const forgeProjectStatus = pgEnum("forge_project_status", ["intake", "research", "strategy", "sitemap", "copy", "design", "build", "qa", "integrations", "preview", "client_review", "ready_to_deploy", "deployed", "archived"])
export const forgePriority = pgEnum("forge_priority", ["low", "medium", "high"])
export const forgeTaskAgentType = pgEnum("forge_task_agent_type", ["intake", "research", "strategy", "sitemap", "copy", "design", "frontend", "integration", "seo", "qa", "deploy", "repair"])
export const forgeTaskStatus = pgEnum("forge_task_status", ["queued", "running", "completed", "failed", "cancelled"])
export const forgeTaskResultQuality = pgEnum("forge_task_result_quality", ["validated", "degraded", "fallback", "requires_review", "failed"])
export const forgeArtifactType = pgEnum("forge_artifact_type", ["research_report", "sitemap", "copy_doc", "design_direction", "component_spec", "generated_code", "visual_critique", "qa_report", "seo_pack", "visual_qa", "proposal", "handover_doc", "deployment_notes", "export_record"])
export const forgeIntegrationProvider = pgEnum("forge_integration_provider", ["resend", "whatsapp", "analytics", "calendly", "stripe", "cloudinary", "custom"])
export const clientRequestCategory = pgEnum("client_request_category", ["website_update", "website_issue", "form_issue", "seo_request", "new_page", "content_assets", "urgent_support", "general_support"])
export const clientRequestPriority = pgEnum("client_request_priority", ["low", "medium", "high", "critical"])
export const clientRequestStatus = pgEnum("client_request_status", ["new", "triaged", "in_progress", "waiting_client", "completed", "cancelled"])
export const requestMessageSenderType = pgEnum("request_message_sender_type", ["client", "admin", "system"])
export const requestMessageVisibility = pgEnum("request_message_visibility", ["client_visible", "internal"])
export const monthlyReportStatus = pgEnum("monthly_report_status", ["draft", "published"])
export const monthlyReportGeneratedBy = pgEnum("monthly_report_generated_by", ["forge", "manual"])
export const salesProposalGeneratedBy = pgEnum("sales_proposal_generated_by", ["forge", "manual"])
export const adminUserRole = pgEnum("admin_user_role", ["owner", "administrator", "sales", "project_manager", "developer", "finance", "viewer"])

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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

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

// Lightweight job queue for long-running Forge actions. The API enqueues a row and returns
// quickly; the worker (in-process by default, or a drained queue) executes the handler, which
// updates the detailed forgeTasks/forgeArtifacts/forgeActivityLogs records. `kind` and `status`
// are text (validated in app code) to avoid enum migrations as new job kinds are added.
export const forgeJobs = pgTable("forge_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),
  status: text("status").default("queued").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
  error: text("error"),
  actor: text("actor"),
  attempts: integer("attempts").default(0).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_jobs_project_id_idx").on(table.projectId),
  index("forge_jobs_status_created_at_idx").on(table.status, table.createdAt),
])

export const forgeAiUsage = pgTable("forge_ai_usage", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
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
  index("forge_ai_usage_completed_at_idx").on(table.completedAt),
  index("forge_ai_usage_provider_idx").on(table.provider),
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
  integrationConfigs: many(forgeIntegrationConfigs),
  activityLogs: many(forgeActivityLogs),
  memories: many(forgeMemories),
  jobs: many(forgeJobs),
  aiUsage: many(forgeAiUsage),
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
}))

export const forgeArtifactRelations = relations(forgeArtifacts, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [forgeArtifacts.projectId],
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
