DO $$ BEGIN
 CREATE TYPE "public"."client_request_category" AS ENUM('website_update','website_issue','form_issue','seo_request','new_page','content_assets','urgent_support','general_support');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."client_request_priority" AS ENUM('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."client_request_status" AS ENUM('new','triaged','in_progress','waiting_client','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_requests" (
 "id" serial PRIMARY KEY NOT NULL, "client_id" text NOT NULL, "title" text NOT NULL, "description" text NOT NULL,
 "category" "client_request_category" DEFAULT 'general_support' NOT NULL, "priority" "client_request_priority" DEFAULT 'medium' NOT NULL,
 "status" "client_request_status" DEFAULT 'new' NOT NULL, "affected_url" text, "page_url" text, "attachment_metadata" jsonb,
 "internal_notes" text, "forge_summary" text, "forge_suggested_actions" text, "forge_suggested_reply" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_requests_client_id_idx" ON "client_requests" ("client_id");
CREATE INDEX IF NOT EXISTS "client_requests_status_idx" ON "client_requests" ("status");
CREATE INDEX IF NOT EXISTS "client_requests_priority_idx" ON "client_requests" ("priority");
CREATE INDEX IF NOT EXISTS "client_requests_category_idx" ON "client_requests" ("category");
CREATE INDEX IF NOT EXISTS "client_requests_created_at_idx" ON "client_requests" ("created_at");
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."request_message_sender_type" AS ENUM('client', 'admin', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."request_message_visibility" AS ENUM('client_visible', 'internal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_request_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"sender_type" "request_message_sender_type" NOT NULL,
	"sender_name" text NOT NULL,
	"body" text NOT NULL,
	"visibility" "request_message_visibility" DEFAULT 'client_visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_request_messages" ADD CONSTRAINT "client_request_messages_request_id_client_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."client_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_request_messages_request_id_idx" ON "client_request_messages" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_request_messages_visibility_idx" ON "client_request_messages" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_request_messages_created_at_idx" ON "client_request_messages" USING btree ("created_at");
