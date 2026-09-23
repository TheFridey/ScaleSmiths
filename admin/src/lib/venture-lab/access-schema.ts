import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const ventureOpportunities = pgTable("venture_opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentId: integer("experiment_id").notNull(),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  status: text("status").default("DISCOVERED").notNull(),
  createdByService: text("created_by_service"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("venture_opportunities_experiment_status_idx").on(table.experimentId, table.status),
  check("venture_opportunities_status_check", sql`${table.status} in ('DISCOVERED','RESEARCHING','PROPOSED','VALIDATING','KILL','SCALE')`),
])

export const ventureEvidence = pgTable("venture_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentId: integer("experiment_id").notNull(),
  opportunityId: uuid("opportunity_id"),
  sourceUrl: text("source_url").notNull(),
  sourceTitle: text("source_title").notNull(),
  evidenceType: text("evidence_type").notNull(),
  claim: text("claim").notNull(),
  summary: text("summary").notNull(),
  excerpt: text("excerpt").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  contentHash: text("content_hash").notNull(),
  capturedByService: text("captured_by_service"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("venture_evidence_opportunity_created_idx").on(table.opportunityId, table.createdAt),
  check("venture_evidence_excerpt_check", sql`char_length(${table.excerpt}) <= 1000`),
  check("venture_evidence_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
])

export const ventureProposals = pgTable("venture_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentId: integer("experiment_id").notNull(),
  opportunityId: uuid("opportunity_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().default({}).notNull(),
  status: text("status").default("PENDING").notNull(),
  proposedByService: text("proposed_by_service").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("venture_proposals_experiment_status_idx").on(table.experimentId, table.status, table.createdAt),
  check("venture_proposals_kind_check", sql`${table.kind} in ('OPPORTUNITY','EXPERIMENT','DECISION')`),
  check("venture_proposals_status_check", sql`${table.status} in ('PENDING','ACCEPTED','REJECTED','CANCELLED')`),
])

export const ventureControlState = pgTable("venture_control_state", {
  experimentId: integer("experiment_id").primaryKey(),
  currentBlocker: text("current_blocker").notNull(),
  nextDecision: text("next_decision").notNull(),
  updatedByUser: uuid("updated_by_user"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})
