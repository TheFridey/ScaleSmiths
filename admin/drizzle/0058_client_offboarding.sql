CREATE TABLE "client_offboarding_cases" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_id" integer NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "checklist_version" integer NOT NULL,
  "assessment_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "commercial_end_at" timestamp with time zone,
  "retention_review_at" timestamp with time zone,
  "retention_notes" text,
  "production_handoff_notes" text,
  "created_by" uuid,
  "completed_by" uuid,
  "completed_at" timestamp with time zone,
  "reactivated_by" uuid,
  "reactivated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "client_offboarding_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "case_id" integer NOT NULL,
  "item_key" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "destructive" boolean DEFAULT false NOT NULL,
  "blocker" text,
  "evidence" text,
  "completed_by" uuid,
  "completed_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "client_offboarding_items_blocker_check" CHECK ("status" <> 'blocked' OR "blocker" IS NOT NULL),
  CONSTRAINT "client_offboarding_items_completion_check" CHECK (("status" = 'completed' AND "completed_at" IS NOT NULL) OR ("status" <> 'completed' AND "completed_at" IS NULL)),
  CONSTRAINT "client_offboarding_items_status_check" CHECK ("status" IN ('pending','in_progress','blocked','completed','not_applicable'))
);
CREATE TABLE "client_offboarding_audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "case_id" integer NOT NULL,
  "client_id" integer NOT NULL,
  "actor_user_id" uuid,
  "action" text NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "client_offboarding_cases" ADD CONSTRAINT "client_offboarding_cases_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict;
ALTER TABLE "client_offboarding_cases" ADD CONSTRAINT "client_offboarding_cases_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null;
ALTER TABLE "client_offboarding_cases" ADD CONSTRAINT "client_offboarding_cases_completed_by_admin_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."admin_users"("id") ON DELETE set null;
ALTER TABLE "client_offboarding_cases" ADD CONSTRAINT "client_offboarding_cases_reactivated_by_admin_users_id_fk" FOREIGN KEY ("reactivated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null;
ALTER TABLE "client_offboarding_items" ADD CONSTRAINT "client_offboarding_items_case_id_client_offboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."client_offboarding_cases"("id") ON DELETE restrict;
ALTER TABLE "client_offboarding_items" ADD CONSTRAINT "client_offboarding_items_completed_by_admin_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."admin_users"("id") ON DELETE set null;
ALTER TABLE "client_offboarding_audit_logs" ADD CONSTRAINT "client_offboarding_audit_logs_case_id_client_offboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."client_offboarding_cases"("id") ON DELETE restrict;
ALTER TABLE "client_offboarding_audit_logs" ADD CONSTRAINT "client_offboarding_audit_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict;
ALTER TABLE "client_offboarding_audit_logs" ADD CONSTRAINT "client_offboarding_audit_logs_actor_user_id_admin_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null;
CREATE INDEX "client_offboarding_cases_client_idx" ON "client_offboarding_cases" ("client_id", "created_at");
CREATE UNIQUE INDEX "client_offboarding_cases_open_idx" ON "client_offboarding_cases" ("client_id") WHERE "status" IN ('draft','in_progress','ready');
CREATE UNIQUE INDEX "client_offboarding_items_case_key_idx" ON "client_offboarding_items" ("case_id", "item_key");
CREATE INDEX "client_offboarding_items_case_status_idx" ON "client_offboarding_items" ("case_id", "status");
CREATE INDEX "client_offboarding_audit_case_idx" ON "client_offboarding_audit_logs" ("case_id", "created_at");
ALTER TABLE "client_offboarding_cases" ADD CONSTRAINT "client_offboarding_cases_status_check" CHECK ("status" IN ('draft','in_progress','ready','completed','cancelled','reactivated'));
