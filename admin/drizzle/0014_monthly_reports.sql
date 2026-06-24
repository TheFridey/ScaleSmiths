DO $$ BEGIN
 CREATE TYPE "public"."monthly_report_status" AS ENUM('draft', 'published');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."monthly_report_generated_by" AS ENUM('forge', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"html_content" text NOT NULL,
	"status" "monthly_report_status" DEFAULT 'draft' NOT NULL,
	"generated_by" "monthly_report_generated_by" DEFAULT 'forge' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_reports_client_id_idx" ON "monthly_reports" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_reports_period_idx" ON "monthly_reports" USING btree ("client_id","year","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_reports_status_idx" ON "monthly_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_reports_published_at_idx" ON "monthly_reports" USING btree ("published_at");
