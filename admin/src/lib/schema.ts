import { relations } from "drizzle-orm"
import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

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
export const forgeArtifactType = pgEnum("forge_artifact_type", ["research_report", "sitemap", "copy_doc", "design_direction", "component_spec", "generated_code", "qa_report", "seo_pack", "visual_qa", "proposal", "handover_doc", "deployment_notes", "export_record"])
export const forgeIntegrationProvider = pgEnum("forge_integration_provider", ["resend", "whatsapp", "analytics", "calendly", "stripe", "cloudinary", "custom"])

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
])

export const forgeArtifacts = pgTable("forge_artifacts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "cascade" }).notNull(),
  type: forgeArtifactType("type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  version: integer("version").default(1).notNull(),
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

export const clientRelations = relations(clients, ({ many }) => ({
  kanbanCards: many(kanbanCards),
  messages: many(messages),
  convertedProspects: many(prospects),
  forgeProjects: many(forgeProjects),
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
}))

export const forgeTaskRelations = relations(forgeTasks, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [forgeTasks.projectId],
    references: [forgeProjects.id],
  }),
}))

export const forgeJobRelations = relations(forgeJobs, ({ one }) => ({
  project: one(forgeProjects, {
    fields: [forgeJobs.projectId],
    references: [forgeProjects.id],
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
