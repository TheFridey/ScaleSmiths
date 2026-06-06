CREATE TABLE "portal_client_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_client_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "quote_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
