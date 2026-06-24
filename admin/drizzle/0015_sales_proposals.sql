CREATE TYPE "public"."sales_proposal_generated_by" AS ENUM('forge', 'manual');

CREATE TABLE "sales_proposals" (
  "id" serial PRIMARY KEY NOT NULL,
  "prospect_id" integer,
  "client_id" integer,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "html_content" text NOT NULL,
  "status" "proposal_status" DEFAULT 'draft' NOT NULL,
  "generated_by" "sales_proposal_generated_by" DEFAULT 'forge' NOT NULL,
  "selected_services" text,
  "build_price" integer DEFAULT 0 NOT NULL,
  "retainer_price" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone
);

ALTER TABLE "sales_proposals" ADD CONSTRAINT "sales_proposals_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sales_proposals" ADD CONSTRAINT "sales_proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "sales_proposals_prospect_id_idx" ON "sales_proposals" USING btree ("prospect_id");
CREATE INDEX "sales_proposals_client_id_idx" ON "sales_proposals" USING btree ("client_id");
CREATE INDEX "sales_proposals_status_idx" ON "sales_proposals" USING btree ("status");
CREATE INDEX "sales_proposals_updated_at_idx" ON "sales_proposals" USING btree ("updated_at");
