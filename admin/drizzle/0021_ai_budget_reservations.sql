CREATE TABLE "forge_ai_budget_reservations" (
  "id" serial PRIMARY KEY NOT NULL, "idempotency_key" text NOT NULL, "project_id" integer, "task_id" integer,
  "provider" text NOT NULL, "model" text NOT NULL, "status" text DEFAULT 'reserved' NOT NULL,
  "reserved_cost" numeric(12,6) NOT NULL, "actual_cost" numeric(12,6), "usage_known" boolean DEFAULT false NOT NULL,
  "fallback_provider" text, "expires_at" timestamp with time zone NOT NULL, "reconciled_at" timestamp with time zone,
  "failure_category" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "forge_ai_budget_reservations_reserved_nonnegative" CHECK ("reserved_cost" >= 0),
  CONSTRAINT "forge_ai_budget_reservations_actual_nonnegative" CHECK ("actual_cost" IS NULL OR "actual_cost" >= 0),
  CONSTRAINT "forge_ai_budget_reservations_status_check" CHECK ("status" IN ('reserved','reconciled','released','failed','abandoned'))
);
ALTER TABLE "forge_ai_budget_reservations" ADD CONSTRAINT "forge_ai_budget_reservations_project_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE SET NULL;
ALTER TABLE "forge_ai_budget_reservations" ADD CONSTRAINT "forge_ai_budget_reservations_task_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forge_tasks"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX "forge_ai_budget_reservations_idempotency_idx" ON "forge_ai_budget_reservations" ("idempotency_key");
CREATE INDEX "forge_ai_budget_reservations_status_expiry_idx" ON "forge_ai_budget_reservations" ("status", "expires_at");
CREATE INDEX "forge_ai_budget_reservations_project_idx" ON "forge_ai_budget_reservations" ("project_id", "created_at");
CREATE INDEX "forge_ai_budget_reservations_provider_idx" ON "forge_ai_budget_reservations" ("provider", "created_at");
