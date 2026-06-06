ALTER TYPE "public"."quote_status" ADD VALUE 'reviewed';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'contacted';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'qualified';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'won';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'lost';--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "care_plan_interest" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "preferred_contact_method" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "lead_quality" text DEFAULT 'medium' NOT NULL;