CREATE TABLE "client_service_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"catalogue_item_id" integer NOT NULL,
	"source_prospect_id" integer,
	"assigned_by" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"project_id" integer,
	"draft_invoice_id" integer,
	"actor_user_id" uuid,
	"client_action" text NOT NULL,
	"assigned_tier" text,
	"portal_provisioning_prepared" boolean DEFAULT false NOT NULL,
	"onboarding_task_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"converted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_service_assignments" ADD CONSTRAINT "client_service_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_assignments" ADD CONSTRAINT "client_service_assignments_catalogue_item_id_invoice_catalogue_items_id_fk" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."invoice_catalogue_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_assignments" ADD CONSTRAINT "client_service_assignments_source_prospect_id_prospects_id_fk" FOREIGN KEY ("source_prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_assignments" ADD CONSTRAINT "client_service_assignments_assigned_by_admin_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_conversions" ADD CONSTRAINT "prospect_conversions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_conversions" ADD CONSTRAINT "prospect_conversions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_conversions" ADD CONSTRAINT "prospect_conversions_project_id_delivery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."delivery_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_conversions" ADD CONSTRAINT "prospect_conversions_draft_invoice_id_invoices_id_fk" FOREIGN KEY ("draft_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_conversions" ADD CONSTRAINT "prospect_conversions_actor_user_id_admin_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_service_assignments_client_catalogue_idx" ON "client_service_assignments" USING btree ("client_id","catalogue_item_id");--> statement-breakpoint
CREATE INDEX "client_service_assignments_prospect_idx" ON "client_service_assignments" USING btree ("source_prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prospect_conversions_prospect_idx" ON "prospect_conversions" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "prospect_conversions_client_idx" ON "prospect_conversions" USING btree ("client_id","converted_at");