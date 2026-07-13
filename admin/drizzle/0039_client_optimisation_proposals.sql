CREATE TYPE "public"."optimisation_proposal_status" AS ENUM('proposed', 'accepted', 'rejected', 'completed', 'measured');--> statement-breakpoint
CREATE TABLE "client_optimisation_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"proposal_key" text NOT NULL,
	"status" "optimisation_proposal_status" DEFAULT 'proposed' NOT NULL,
	"title" text NOT NULL,
	"evidence_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_impact" text NOT NULL,
	"confidence" text NOT NULL,
	"estimated_effort" text NOT NULL,
	"risk" text NOT NULL,
	"proposed_change" text NOT NULL,
	"validation_method" text NOT NULL,
	"rollback_plan" text NOT NULL,
	"required_approval" text NOT NULL,
	"relevant_pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"relevant_artifacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_metric" text NOT NULL,
	"baseline_value" numeric(12, 4),
	"measured_value" numeric(12, 4),
	"improved" boolean,
	"outcome_notes" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"measured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_optimisation_proposals" ADD CONSTRAINT "client_optimisation_proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_optimisation_proposals_client_idx" ON "client_optimisation_proposals" USING btree ("client_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "client_optimisation_proposals_key_idx" ON "client_optimisation_proposals" USING btree ("client_id","proposal_key");
