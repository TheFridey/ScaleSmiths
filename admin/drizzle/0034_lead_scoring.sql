CREATE TYPE "public"."lead_score_outcome" AS ENUM('won', 'lost', 'no_decision', 'disqualified');--> statement-breakpoint
CREATE TABLE "lead_score_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" integer NOT NULL,
	"score" integer NOT NULL,
	"confidence" text NOT NULL,
	"probability_of_closing" integer NOT NULL,
	"estimated_project_value" integer DEFAULT 0 NOT NULL,
	"estimated_retainer_potential" integer DEFAULT 0 NOT NULL,
	"recommended_next_action" text NOT NULL,
	"positive_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"negative_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"neutral_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_information" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"affected_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_version" text NOT NULL,
	"override_score" integer,
	"override_reason" text,
	"override_by" text,
	"override_at" timestamp with time zone,
	"outcome" "lead_score_outcome",
	"outcome_value" integer,
	"outcome_retainer" integer,
	"outcome_notes" text,
	"outcome_recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_score_snapshots" ADD CONSTRAINT "lead_score_snapshots_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_score_snapshots_prospect_id_idx" ON "lead_score_snapshots" USING btree ("prospect_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_score_snapshots_score_idx" ON "lead_score_snapshots" USING btree ("score");--> statement-breakpoint
CREATE INDEX "lead_score_snapshots_outcome_idx" ON "lead_score_snapshots" USING btree ("outcome","outcome_recorded_at");
