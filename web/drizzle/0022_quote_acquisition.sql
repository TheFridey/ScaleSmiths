ALTER TABLE "quote_requests" ADD COLUMN "acquisition_landing_path" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "acquisition_submission_path" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "acquisition_referrer_host" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "acquisition_referrer_path" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "acquisition_utm_source" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "acquisition_utm_medium" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "acquisition_utm_campaign" text;
