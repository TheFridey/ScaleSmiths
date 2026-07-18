ALTER TABLE "client_analytics_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_analytics_configs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "client_analytics_configs_tenant" ON "client_analytics_configs";--> statement-breakpoint
CREATE POLICY "client_analytics_configs_tenant" ON "client_analytics_configs"
	USING ("client_id" = NULLIF(current_setting('app.current_client_id', true), '')::integer)
	WITH CHECK ("client_id" = NULLIF(current_setting('app.current_client_id', true), '')::integer);--> statement-breakpoint

ALTER TABLE "client_analytics_daily_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_analytics_daily_metrics" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "client_analytics_daily_metrics_tenant" ON "client_analytics_daily_metrics";--> statement-breakpoint
CREATE POLICY "client_analytics_daily_metrics_tenant" ON "client_analytics_daily_metrics"
	USING ("client_id" = NULLIF(current_setting('app.current_client_id', true), '')::integer)
	WITH CHECK ("client_id" = NULLIF(current_setting('app.current_client_id', true), '')::integer);--> statement-breakpoint

ALTER TABLE "client_analytics_audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_analytics_audit_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "client_analytics_audit_logs_tenant" ON "client_analytics_audit_logs";--> statement-breakpoint
CREATE POLICY "client_analytics_audit_logs_tenant" ON "client_analytics_audit_logs"
	USING ("client_id" = NULLIF(current_setting('app.current_client_id', true), '')::integer)
	WITH CHECK ("client_id" = NULLIF(current_setting('app.current_client_id', true), '')::integer);--> statement-breakpoint

ALTER TABLE "client_optimisation_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_optimisation_proposals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "client_optimisation_proposals_tenant" ON "client_optimisation_proposals";--> statement-breakpoint
CREATE POLICY "client_optimisation_proposals_tenant" ON "client_optimisation_proposals"
	USING ("client_id" = NULLIF(current_setting('app.current_client_id', true), '')::integer)
	WITH CHECK ("client_id" = NULLIF(current_setting('app.current_client_id', true), '')::integer);
