ALTER TABLE "client_requests" ADD COLUMN IF NOT EXISTS "notification_email_status" text;
ALTER TABLE "client_requests" ADD COLUMN IF NOT EXISTS "notification_email_failure_reason" text;
