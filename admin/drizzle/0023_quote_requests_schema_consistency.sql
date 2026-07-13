DO $$ BEGIN
 CREATE TYPE "public"."quote_status" AS ENUM('new','read','replied','reviewed','contacted','qualified','won','lost');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_requests" (
 "id" serial PRIMARY KEY NOT NULL, "name" text NOT NULL, "email" text NOT NULL, "business" text, "website_url" text,
 "business_type" text, "project_type" text, "budget" text, "launch_timeframe" text, "main_goal" text, "needs" text,
 "care_plan_interest" text, "preferred_contact_method" text, "consent" boolean DEFAULT false NOT NULL,
 "lead_quality" text DEFAULT 'medium' NOT NULL, "email_delivery_status" text DEFAULT 'pending' NOT NULL,
 "email_failure_reason" text, "brief" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "status" "quote_status" DEFAULT 'new' NOT NULL
);
