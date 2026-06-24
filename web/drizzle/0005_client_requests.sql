CREATE TYPE "public"."client_request_category" AS ENUM('website_update', 'website_issue', 'form_issue', 'seo_request', 'new_page', 'content_assets', 'urgent_support', 'general_support');--> statement-breakpoint
CREATE TYPE "public"."client_request_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."client_request_status" AS ENUM('new', 'triaged', 'in_progress', 'waiting_client', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "client_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" "client_request_category" DEFAULT 'general_support' NOT NULL,
	"priority" "client_request_priority" DEFAULT 'medium' NOT NULL,
	"status" "client_request_status" DEFAULT 'new' NOT NULL,
	"affected_url" text,
	"page_url" text,
	"attachment_metadata" jsonb,
	"internal_notes" text,
	"forge_summary" text,
	"forge_suggested_actions" text,
	"forge_suggested_reply" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "client_requests_client_id_idx" ON "client_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_requests_status_idx" ON "client_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_requests_priority_idx" ON "client_requests" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "client_requests_category_idx" ON "client_requests" USING btree ("category");--> statement-breakpoint
CREATE INDEX "client_requests_created_at_idx" ON "client_requests" USING btree ("created_at");