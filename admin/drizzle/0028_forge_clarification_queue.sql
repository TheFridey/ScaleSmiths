CREATE TABLE IF NOT EXISTS "forge_clarification_questions" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer NOT NULL,
  "task_id" integer,
  "artifact_id" integer,
  "fact_key" text NOT NULL,
  "question" text NOT NULL,
  "category" text NOT NULL,
  "urgency" text DEFAULT 'medium' NOT NULL,
  "assignee" text,
  "status" text DEFAULT 'open' NOT NULL,
  "group_key" text NOT NULL,
  "duplicate_key" text NOT NULL,
  "evidence_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_type" text NOT NULL,
  "source_detail" text,
  "answer" text,
  "answered_by" text,
  "answered_at" timestamp with time zone,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "revalidate_after" timestamp with time zone,
  "metadata_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forge_project_facts" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "category" text NOT NULL,
  "source_type" text NOT NULL,
  "source_question_id" integer,
  "source_artifact_id" integer,
  "source_task_id" integer,
  "answered_by" text,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "revalidate_after" timestamp with time zone,
  "superseded_at" timestamp with time zone,
  "confidence" numeric(5, 2),
  "provenance_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forge_clarification_questions" ADD CONSTRAINT "forge_clarification_questions_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forge_clarification_questions" ADD CONSTRAINT "forge_clarification_questions_task_id_forge_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forge_tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forge_clarification_questions" ADD CONSTRAINT "forge_clarification_questions_artifact_id_forge_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."forge_artifacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forge_project_facts" ADD CONSTRAINT "forge_project_facts_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forge_project_facts" ADD CONSTRAINT "forge_project_facts_source_question_id_forge_clarification_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."forge_clarification_questions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forge_project_facts" ADD CONSTRAINT "forge_project_facts_source_artifact_id_forge_artifacts_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."forge_artifacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forge_project_facts" ADD CONSTRAINT "forge_project_facts_source_task_id_forge_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."forge_tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forge_clarification_questions_project_duplicate_idx" ON "forge_clarification_questions" USING btree ("project_id","duplicate_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_clarification_questions_project_status_idx" ON "forge_clarification_questions" USING btree ("project_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_clarification_questions_task_idx" ON "forge_clarification_questions" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_clarification_questions_fact_key_idx" ON "forge_clarification_questions" USING btree ("project_id","fact_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forge_project_facts_project_key_idx" ON "forge_project_facts" USING btree ("project_id","key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_project_facts_project_category_idx" ON "forge_project_facts" USING btree ("project_id","category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_project_facts_revalidate_idx" ON "forge_project_facts" USING btree ("revalidate_after");
