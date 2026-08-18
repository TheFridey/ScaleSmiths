CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "invoice_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_catalogue_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_unit_amount" integer NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"category" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_catalogue_unit_amount_check" CHECK ("invoice_catalogue_items"."default_unit_amount" >= 0),
	CONSTRAINT "invoice_catalogue_currency_check" CHECK ("invoice_catalogue_items"."currency" = 'GBP')
);
--> statement-breakpoint
CREATE TABLE "invoice_supplier_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"legal_name" text,
	"trading_name" text,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"county" text,
	"postcode" text,
	"country" text,
	"contact_email" text,
	"website" text,
	"company_number" text,
	"vat_number" text,
	"payment_instructions" text,
	"payment_account_name" text,
	"payment_sort_code" text,
	"payment_account_number" text,
	"payment_reference_instructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_supplier_settings_singleton_check" CHECK ("invoice_supplier_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"catalogue_item_id" integer,
	"title" text NOT NULL,
	"description" text,
	"quantity" integer NOT NULL,
	"unit_amount" integer NOT NULL,
	"line_amount" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_items_quantity_check" CHECK ("invoice_items"."quantity" > 0),
	CONSTRAINT "invoice_items_unit_amount_check" CHECK ("invoice_items"."unit_amount" >= 0),
	CONSTRAINT "invoice_items_line_amount_check" CHECK ("invoice_items"."line_amount" = "invoice_items"."quantity" * "invoice_items"."unit_amount")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text,
	"client_id" integer NOT NULL,
	"sequence_number" integer,
	"client_code_snapshot" text,
	"client_name_snapshot" text NOT NULL,
	"billing_contact_name_snapshot" text,
	"billing_email_snapshot" text,
	"billing_address_line_1_snapshot" text,
	"billing_address_line_2_snapshot" text,
	"billing_city_snapshot" text,
	"billing_county_snapshot" text,
	"billing_postcode_snapshot" text,
	"billing_country_snapshot" text,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"invoice_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal" integer NOT NULL,
	"total" integer NOT NULL,
	"internal_notes" text,
	"customer_notes" text,
	"issued_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"document_template_version" text,
	"supplier_snapshot" jsonb,
	"payment_snapshot" jsonb,
	"document_pdf" bytea,
	"document_pdf_sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_lifecycle_check" CHECK (("invoices"."status" = 'draft' and "invoices"."invoice_number" is null and "invoices"."sequence_number" is null and "invoices"."issued_at" is null) or ("invoices"."status" <> 'draft' and "invoices"."invoice_number" is not null and "invoices"."sequence_number" > 0 and "invoices"."issued_at" is not null)),
	CONSTRAINT "invoices_amounts_check" CHECK ("invoices"."subtotal" >= 0 and "invoices"."total" = "invoices"."subtotal"),
	CONSTRAINT "invoices_currency_check" CHECK ("invoices"."currency" = 'GBP'),
	CONSTRAINT "invoices_dates_check" CHECK ("invoices"."due_date" >= "invoices"."invoice_date"),
	CONSTRAINT "invoices_document_snapshot_lifecycle_check" CHECK (("invoices"."status" = 'draft' and "invoices"."document_template_version" is null and "invoices"."supplier_snapshot" is null and "invoices"."payment_snapshot" is null and "invoices"."document_pdf" is null and "invoices"."document_pdf_sha256" is null) or ("invoices"."status" <> 'draft' and "invoices"."document_template_version" is not null and "invoices"."supplier_snapshot" is not null and "invoices"."payment_snapshot" is not null and "invoices"."document_pdf" is not null and "invoices"."document_pdf_sha256" is not null))
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "invoice_client_code" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "next_invoice_sequence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_address_line_1" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_address_line_2" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_city" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_county" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_postcode" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_country" text;--> statement-breakpoint
ALTER TABLE "invoice_audit_logs" ADD CONSTRAINT "invoice_audit_logs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_audit_logs" ADD CONSTRAINT "invoice_audit_logs_actor_user_id_admin_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_catalogue_item_id_invoice_catalogue_items_id_fk" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."invoice_catalogue_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_audit_invoice_idx" ON "invoice_audit_logs" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_position_idx" ON "invoice_items" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_client_sequence_idx" ON "invoices" USING btree ("client_id","sequence_number");--> statement-breakpoint
CREATE INDEX "invoices_client_date_idx" ON "invoices" USING btree ("client_id","invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_status_due_date_idx" ON "invoices" USING btree ("status","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_invoice_client_code_idx" ON "clients" USING btree ("invoice_client_code");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_invoice_client_code_format_check" CHECK ("clients"."invoice_client_code" is null or "clients"."invoice_client_code" ~ '^[A-Z0-9]{2,12}$');--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_next_invoice_sequence_check" CHECK ("clients"."next_invoice_sequence" > 0);
--> statement-breakpoint
CREATE TYPE "public"."invoice_delivery_state" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_delivery_type" AS ENUM('invoice', 'reminder');--> statement-breakpoint
CREATE TYPE "public"."invoice_portal_access_type" AS ENUM('view', 'download');--> statement-breakpoint
CREATE TABLE "invoice_delivery_attempts" (
 "id" serial PRIMARY KEY NOT NULL, "invoice_id" integer NOT NULL, "delivery_type" "invoice_delivery_type" NOT NULL,
 "state" "invoice_delivery_state" DEFAULT 'pending' NOT NULL, "channel" text DEFAULT 'email' NOT NULL,
 "recipient" text NOT NULL, "subject" text NOT NULL, "operation_key" text NOT NULL, "provider_message_id" text,
 "document_sha256" text, "failure_category" text, "failure_message" text, "initiated_by" uuid,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL, "sent_at" timestamp with time zone, "failed_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "invoice_portal_access_events" (
 "id" serial PRIMARY KEY NOT NULL, "invoice_id" integer NOT NULL, "portal_client_id" text NOT NULL,
 "access_type" "invoice_portal_access_type" NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "portal_client_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "portal_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "portal_published_by" uuid;--> statement-breakpoint
ALTER TABLE "invoice_delivery_attempts" ADD CONSTRAINT "invoice_delivery_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_delivery_attempts" ADD CONSTRAINT "invoice_delivery_attempts_initiated_by_admin_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_portal_access_events" ADD CONSTRAINT "invoice_portal_access_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_delivery_operation_key_idx" ON "invoice_delivery_attempts" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "invoice_delivery_invoice_created_idx" ON "invoice_delivery_attempts" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_portal_access_invoice_idx" ON "invoice_portal_access_events" USING btree ("invoice_id","created_at");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_portal_published_by_admin_users_id_fk" FOREIGN KEY ("portal_published_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_portal_client_id_idx" ON "clients" USING btree ("portal_client_id");
