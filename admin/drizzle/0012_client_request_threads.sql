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
