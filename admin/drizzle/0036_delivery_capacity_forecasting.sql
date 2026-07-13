CREATE TYPE "public"."delivery_capacity_adjustment_type" AS ENUM('capacity_override', 'time_off', 'contractor_capacity', 'sales_commitment', 'actual_delivery');--> statement-breakpoint
CREATE TABLE "delivery_capacity_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"adjustment_type" "delivery_capacity_adjustment_type" NOT NULL,
	"staff_name" text,
	"role" text,
	"hours" integer NOT NULL,
	"reason" text NOT NULL,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_forecast_actuals" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_type" text DEFAULT 'week' NOT NULL,
	"forecast_hours" integer NOT NULL,
	"actual_hours" integer NOT NULL,
	"notes" text,
	"recorded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "delivery_capacity_adjustments_week_idx" ON "delivery_capacity_adjustments" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "delivery_capacity_adjustments_type_idx" ON "delivery_capacity_adjustments" USING btree ("adjustment_type","week_start");--> statement-breakpoint
CREATE INDEX "delivery_forecast_actuals_period_idx" ON "delivery_forecast_actuals" USING btree ("period_type","period_start");
