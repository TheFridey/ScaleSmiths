CREATE TYPE "public"."analytics_provider" AS ENUM('manual', 'google_search_console', 'google_analytics', 'plausible', 'uptime', 'core_web_vitals', 'custom');--> statement-breakpoint
CREATE TYPE "public"."analytics_metric_source" AS ENUM('analytics', 'search_console', 'forms', 'phone', 'performance', 'errors', 'uptime', 'manual', 'custom');--> statement-breakpoint
CREATE TABLE "client_analytics_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"provider" "analytics_provider" NOT NULL,
	"display_name" text NOT NULL,
	"property_id" text,
	"consent_granted" boolean DEFAULT false NOT NULL,
	"consent_notes" text,
	"retention_days" integer DEFAULT 395 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"credentials_encrypted" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_attribution" text NOT NULL,
	"last_ingested_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_analytics_daily_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"config_id" integer,
	"metric_date" timestamp with time zone NOT NULL,
	"source" "analytics_metric_source" NOT NULL,
	"source_attribution" text NOT NULL,
	"sessions" integer,
	"conversion_events" integer,
	"form_submissions" integer,
	"phone_clicks" integer,
	"cta_clicks" integer,
	"search_impressions" integer,
	"search_clicks" integer,
	"error_count" integer,
	"uptime_checks" integer,
	"uptime_failures" integer,
	"lcp_p75_ms" integer,
	"inp_p75_ms" integer,
	"cls_p75" numeric(6, 4),
	"raw_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_analytics_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"config_id" integer,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"message" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_analytics_configs" ADD CONSTRAINT "client_analytics_configs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_analytics_daily_metrics" ADD CONSTRAINT "client_analytics_daily_metrics_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_analytics_daily_metrics" ADD CONSTRAINT "client_analytics_daily_metrics_config_id_client_analytics_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."client_analytics_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_analytics_audit_logs" ADD CONSTRAINT "client_analytics_audit_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_analytics_audit_logs" ADD CONSTRAINT "client_analytics_audit_logs_config_id_client_analytics_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."client_analytics_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_analytics_configs_client_idx" ON "client_analytics_configs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_analytics_configs_provider_idx" ON "client_analytics_configs" USING btree ("provider","enabled");--> statement-breakpoint
CREATE INDEX "client_analytics_daily_client_date_idx" ON "client_analytics_daily_metrics" USING btree ("client_id","metric_date");--> statement-breakpoint
CREATE INDEX "client_analytics_daily_source_idx" ON "client_analytics_daily_metrics" USING btree ("source","metric_date");--> statement-breakpoint
CREATE INDEX "client_analytics_audit_client_idx" ON "client_analytics_audit_logs" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "client_analytics_audit_config_idx" ON "client_analytics_audit_logs" USING btree ("config_id","created_at");
