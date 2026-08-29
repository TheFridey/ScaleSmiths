ALTER TABLE "client_request_messages" ADD COLUMN "notification_email_status" text;--> statement-breakpoint
ALTER TABLE "client_request_messages" ADD COLUMN "notification_email_failure_reason" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "client_last_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "admin_last_read_at" timestamp with time zone;
