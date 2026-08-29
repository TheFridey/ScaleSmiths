ALTER TABLE "client_timeline_events" ADD COLUMN "client_record_id" integer;--> statement-breakpoint
ALTER TABLE "client_timeline_events" ADD COLUMN "source_domain" text;--> statement-breakpoint
ALTER TABLE "client_timeline_events" ADD COLUMN "source_reference" text;--> statement-breakpoint
ALTER TABLE "client_timeline_events" ADD COLUMN "actor_type" text;--> statement-breakpoint
ALTER TABLE "client_timeline_events" ADD COLUMN "actor_id" text;--> statement-breakpoint
ALTER TABLE "client_timeline_events" ADD COLUMN "actor_label" text;--> statement-breakpoint
ALTER TABLE "client_timeline_events" ADD COLUMN "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "client_timeline_events" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "client_timeline_events" ADD COLUMN "occurred_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "client_timeline_events" AS event SET "client_record_id" = client."id", "source_domain" = CASE WHEN event."request_id" IS NOT NULL THEN 'request' WHEN event."project_id" IS NOT NULL THEN 'project' ELSE 'manual' END, "source_reference" = 'legacy:' || event."id", "actor_type" = 'system', "actor_label" = event."created_by", "idempotency_key" = 'legacy:' || event."id", "occurred_at" = event."created_at" FROM "clients" AS client WHERE client."portal_client_id" = event."client_id";--> statement-breakpoint
UPDATE "client_timeline_events" SET "source_domain" = COALESCE("source_domain", 'manual'), "source_reference" = COALESCE("source_reference", 'legacy:' || "id"), "actor_type" = COALESCE("actor_type", 'system'), "actor_label" = COALESCE("actor_label", "created_by"), "idempotency_key" = COALESCE("idempotency_key", 'legacy:' || "id"), "occurred_at" = "created_at";--> statement-breakpoint
ALTER TABLE "client_timeline_events" ADD CONSTRAINT "client_timeline_events_client_record_id_clients_id_fk" FOREIGN KEY ("client_record_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_timeline_events_client_record_idx" ON "client_timeline_events" USING btree ("client_record_id", "occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_timeline_events_idempotency_idx" ON "client_timeline_events" USING btree ("idempotency_key");
