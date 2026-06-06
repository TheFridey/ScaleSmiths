import { boolean, integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const quoteStatus = pgEnum("quote_status", ["new", "read", "replied", "reviewed", "contacted", "qualified", "won", "lost"])

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
