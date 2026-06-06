CREATE TYPE "public"."prospect_source" AS ENUM('linkedin', 'email', 'facebook', 'local', 'referral', 'inbound', 'other');--> statement-breakpoint
CREATE TYPE "public"."prospect_stage" AS ENUM('found', 'audited', 'contacted', 'replied', 'discovery_booked', 'proposal_sent', 'follow_up_due', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."prospect_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."outreach_activity_type" AS ENUM('linkedin_message', 'email', 'phone_call', 'facebook_message', 'in_person', 'follow_up', 'proposal', 'note');--> statement-breakpoint
CREATE TYPE "public"."outreach_direction" AS ENUM('outbound', 'inbound', 'internal');--> statement-breakpoint
CREATE TYPE "public"."proposal_package_type" AS ENUM('foundation', 'growth', 'forge', 'retainer', 'custom');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'viewed', 'follow_up_due', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"website_url" text,
	"location" text,
	"industry" text,
	"source" "prospect_source" DEFAULT 'other' NOT NULL,
	"stage" "prospect_stage" DEFAULT 'found' NOT NULL,
	"estimated_project_value" integer DEFAULT 0 NOT NULL,
	"estimated_monthly_retainer" integer DEFAULT 0 NOT NULL,
	"priority" "prospect_priority" DEFAULT 'medium' NOT NULL,
	"revenue_score" integer DEFAULT 0 NOT NULL,
	"trust_score" integer DEFAULT 0 NOT NULL,
	"conversion_score" integer DEFAULT 0 NOT NULL,
	"seo_score" integer DEFAULT 0 NOT NULL,
	"mobile_score" integer DEFAULT 0 NOT NULL,
	"audit_summary" text,
	"pain_points" text,
	"opportunity_notes" text,
	"objection_notes" text,
	"next_follow_up_at" timestamp with time zone,
	"last_contacted_at" timestamp with time zone,
	"discovery_call_at" timestamp with time zone,
	"proposal_sent_at" timestamp with time zone,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"lost_reason" text,
	"converted_client_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" integer NOT NULL,
	"type" "outreach_activity_type" NOT NULL,
	"direction" "outreach_direction" NOT NULL,
	"subject" text,
	"body" text,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "proposal_trackings" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" integer NOT NULL,
	"package_type" "proposal_package_type" DEFAULT 'custom' NOT NULL,
	"quoted_amount" integer DEFAULT 0 NOT NULL,
	"monthly_retainer_amount" integer DEFAULT 0 NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_converted_client_id_clients_id_fk" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_activities" ADD CONSTRAINT "outreach_activities_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_trackings" ADD CONSTRAINT "proposal_trackings_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;
