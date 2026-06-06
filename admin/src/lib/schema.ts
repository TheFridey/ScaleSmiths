import { relations } from "drizzle-orm"
import { boolean, integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

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

export const clientRelations = relations(clients, ({ many }) => ({
  kanbanCards: many(kanbanCards),
  messages: many(messages),
  convertedProspects: many(prospects),
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
