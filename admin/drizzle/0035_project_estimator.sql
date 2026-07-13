CREATE TYPE "public"."project_estimate_complexity" AS ENUM('low', 'medium', 'high', 'enterprise');--> statement-breakpoint
CREATE TABLE "project_estimate_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"estimated_hours" integer NOT NULL,
	"confidence" text NOT NULL,
	"confidence_range" jsonb NOT NULL,
	"complexity_rating" "project_estimate_complexity" NOT NULL,
	"risk_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_build_price" integer NOT NULL,
	"suggested_retainer" integer NOT NULL,
	"minimum_viable_scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"optional_enhancements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_delivery_range" jsonb NOT NULL,
	"margin_estimate" jsonb NOT NULL,
	"known_inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"underpricing_risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disclaimer" text NOT NULL,
	"model_version" text NOT NULL,
	"manual_hours" integer,
	"manual_build_price" integer,
	"manual_retainer" integer,
	"manual_reason" text,
	"manual_by" text,
	"manual_at" timestamp with time zone,
	"actual_hours" integer,
	"actual_build_price" integer,
	"actual_retainer" integer,
	"actual_notes" text,
	"actual_recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_estimate_snapshots" ADD CONSTRAINT "project_estimate_snapshots_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_estimate_snapshots_project_id_idx" ON "project_estimate_snapshots" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "project_estimate_snapshots_complexity_idx" ON "project_estimate_snapshots" USING btree ("complexity_rating");
