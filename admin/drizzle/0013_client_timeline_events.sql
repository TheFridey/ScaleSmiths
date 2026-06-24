CREATE TABLE IF NOT EXISTS "client_timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"request_id" integer,
	"project_id" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"visibility" "request_message_visibility" DEFAULT 'client_visible' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_timeline_events" ADD CONSTRAINT "client_timeline_events_request_id_client_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."client_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_timeline_events_client_id_idx" ON "client_timeline_events" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_timeline_events_request_id_idx" ON "client_timeline_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_timeline_events_project_id_idx" ON "client_timeline_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_timeline_events_visibility_idx" ON "client_timeline_events" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_timeline_events_created_at_idx" ON "client_timeline_events" USING btree ("created_at");
