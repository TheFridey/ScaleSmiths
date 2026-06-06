CREATE TYPE "public"."quote_status" AS ENUM('new', 'read', 'replied');--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"business" text,
	"project_type" text,
	"budget" text,
	"brief" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "quote_status" DEFAULT 'new' NOT NULL
);
