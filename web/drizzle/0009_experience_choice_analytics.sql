CREATE TYPE "public"."experience_event_name" AS ENUM('experience_choice_displayed', 'experience_normal_selected', 'experience_interactive_selected', 'experience_choice_abandoned', 'experience_returning_preference', 'experience_switched', 'quote_cta_clicked', 'quote_form_started', 'quote_form_submitted', 'navigation_exit', 'interactive_completion_depth', 'experience_fallback_activated', 'experience_error');--> statement-breakpoint
CREATE TYPE "public"."experience_device_class" AS ENUM('mobile', 'tablet', 'desktop', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."experience_preference" AS ENUM('normal', 'interactive', 'none', 'unknown');--> statement-breakpoint
CREATE TABLE "experience_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" "experience_event_name" NOT NULL,
	"event_key" text NOT NULL,
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"device_class" "experience_device_class" DEFAULT 'unknown' NOT NULL,
	"preference" "experience_preference" DEFAULT 'unknown' NOT NULL,
	"returning_preference" boolean DEFAULT false NOT NULL,
	"from_experience" "experience_preference",
	"to_experience" "experience_preference",
	"interactive_step" text,
	"completion_depth" integer,
	"referrer_host" text,
	"campaign_source" text,
	"campaign_medium" text,
	"campaign_name" text,
	"error_category" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "experience_events_event_key_idx" ON "experience_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "experience_events_name_time_idx" ON "experience_events" USING btree ("event_name","occurred_at");--> statement-breakpoint
CREATE INDEX "experience_events_preference_time_idx" ON "experience_events" USING btree ("preference","occurred_at");--> statement-breakpoint
CREATE INDEX "experience_events_session_idx" ON "experience_events" USING btree ("session_id");
