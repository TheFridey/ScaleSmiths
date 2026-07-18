ALTER TYPE "public"."experience_event_name" ADD VALUE IF NOT EXISTS 'local_growth_check_viewed';--> statement-breakpoint
ALTER TYPE "public"."experience_event_name" ADD VALUE IF NOT EXISTS 'local_growth_check_form_started';--> statement-breakpoint
ALTER TYPE "public"."experience_event_name" ADD VALUE IF NOT EXISTS 'local_growth_check_form_submitted';--> statement-breakpoint
ALTER TYPE "public"."experience_event_name" ADD VALUE IF NOT EXISTS 'local_growth_check_full_quote_selected';--> statement-breakpoint
ALTER TYPE "public"."experience_event_name" ADD VALUE IF NOT EXISTS 'local_growth_check_strategy_call_requested';--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "lead_source" text DEFAULT 'public_quote' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "funnel_type" text DEFAULT 'full_quote' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "phone" text;
