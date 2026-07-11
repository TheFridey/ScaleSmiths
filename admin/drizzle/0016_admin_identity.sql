CREATE TYPE "public"."admin_user_role" AS ENUM('owner', 'administrator', 'sales', 'project_manager', 'developer', 'finance', 'viewer');
--> statement-breakpoint
CREATE TABLE "admin_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "display_name" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" "admin_user_role" NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "mfa_enabled" boolean DEFAULT false NOT NULL,
  "mfa_state" jsonb,
  "session_version" integer DEFAULT 1 NOT NULL,
  "last_login_at" timestamp with time zone,
  "password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_lower_idx" ON "admin_users" USING btree (lower("email"));
--> statement-breakpoint
CREATE INDEX "admin_users_role_active_idx" ON "admin_users" USING btree ("role","active");
