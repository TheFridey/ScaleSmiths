ALTER TABLE "portal_client_accounts" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_client_accounts" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portal_client_accounts" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portal_client_accounts" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portal_client_accounts" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portal_client_accounts" ADD CONSTRAINT "portal_client_accounts_status_check" CHECK ("status" IN ('invited','active','disabled','reset_required'));--> statement-breakpoint
UPDATE "portal_client_accounts" SET "status" = CASE WHEN "active" THEN 'active' ELSE 'disabled' END, "activated_at" = CASE WHEN "active" THEN "created_at" ELSE NULL END, "disabled_at" = CASE WHEN "active" THEN NULL ELSE "updated_at" END;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_client_accounts_client_id_idx" ON "portal_client_accounts" USING btree ("client_id");--> statement-breakpoint
CREATE TABLE "portal_account_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "purpose" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "portal_account_tokens_purpose_check" CHECK ("purpose" IN ('activation','reset'))
);--> statement-breakpoint
CREATE TABLE "portal_account_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "token_id" integer,
  "operation_key" text NOT NULL,
  "recipient" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "provider_message_id" text,
  "failure_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  CONSTRAINT "portal_account_notifications_status_check" CHECK ("status" IN ('not_requested','pending','sent','failed'))
);--> statement-breakpoint
ALTER TABLE "portal_account_tokens" ADD CONSTRAINT "portal_account_tokens_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."portal_client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_account_notifications" ADD CONSTRAINT "portal_account_notifications_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."portal_client_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_account_notifications" ADD CONSTRAINT "portal_account_notifications_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."portal_account_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_account_tokens_hash_idx" ON "portal_account_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "portal_account_tokens_account_idx" ON "portal_account_tokens" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_account_notifications_operation_idx" ON "portal_account_notifications" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "portal_account_notifications_account_idx" ON "portal_account_notifications" USING btree ("account_id","created_at");
