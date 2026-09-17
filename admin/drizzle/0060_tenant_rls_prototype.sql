CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
	SELECT NULLIF(current_setting('app.current_client_id', true), '')::integer
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_access_mode()
RETURNS text
LANGUAGE sql
STABLE
AS $$
	SELECT NULLIF(current_setting('app.access_mode', true), '')
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_internal_aggregate()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
	SELECT app_access_mode() IN ('internal_aggregate', 'internal_write')
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_internal_write()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
	SELECT app_access_mode() = 'internal_write'
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_client_owned_visible(p_client_record_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
	SELECT CASE
		WHEN app_is_internal_write() THEN true
		WHEN app_access_mode() = 'internal_aggregate' THEN true
		WHEN app_access_mode() = 'tenant' THEN p_client_record_id IS NOT NULL AND p_client_record_id = app_current_tenant_id()
		ELSE false
	END
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_forge_row_visible(p_client_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
	SELECT CASE
		WHEN app_is_internal_write() OR app_access_mode() = 'internal_aggregate' THEN true
		WHEN app_access_mode() = 'tenant' THEN p_client_id IS NOT NULL AND p_client_id = app_current_tenant_id()
		ELSE false
	END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_current_tenant_id() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_access_mode() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_is_internal_aggregate() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_is_internal_write() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_client_owned_visible(integer) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_forge_row_visible(integer) FROM PUBLIC;--> statement-breakpoint
ALTER TABLE "client_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "client_requests_tenant" ON "client_requests";--> statement-breakpoint
CREATE POLICY "client_requests_tenant" ON "client_requests"
	USING (app_access_mode() = 'tenant' AND client_record_id IS NOT NULL AND client_record_id = app_current_tenant_id())
	WITH CHECK (app_access_mode() = 'tenant' AND client_record_id IS NOT NULL AND client_record_id = app_current_tenant_id());--> statement-breakpoint
DROP POLICY IF EXISTS "client_requests_internal_aggregate" ON "client_requests";--> statement-breakpoint
CREATE POLICY "client_requests_internal_aggregate" ON "client_requests"
	FOR SELECT
	USING (app_is_internal_aggregate());--> statement-breakpoint
DROP POLICY IF EXISTS "client_requests_internal_write" ON "client_requests";--> statement-breakpoint
CREATE POLICY "client_requests_internal_write" ON "client_requests"
	USING (app_is_internal_write())
	WITH CHECK (app_is_internal_write());--> statement-breakpoint
ALTER TABLE "client_request_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_request_messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "client_request_messages_tenant" ON "client_request_messages";--> statement-breakpoint
CREATE POLICY "client_request_messages_tenant" ON "client_request_messages"
	USING (
		app_access_mode() = 'tenant'
		AND EXISTS (
			SELECT 1 FROM client_requests r
			WHERE r.id = client_request_messages.request_id
				AND r.client_record_id IS NOT NULL
				AND r.client_record_id = app_current_tenant_id()
		)
	)
	WITH CHECK (
		app_access_mode() = 'tenant'
		AND EXISTS (
			SELECT 1 FROM client_requests r
			WHERE r.id = client_request_messages.request_id
				AND r.client_record_id IS NOT NULL
				AND r.client_record_id = app_current_tenant_id()
		)
	);--> statement-breakpoint
DROP POLICY IF EXISTS "client_request_messages_internal_aggregate" ON "client_request_messages";--> statement-breakpoint
CREATE POLICY "client_request_messages_internal_aggregate" ON "client_request_messages"
	FOR SELECT
	USING (app_is_internal_aggregate());--> statement-breakpoint
DROP POLICY IF EXISTS "client_request_messages_internal_write" ON "client_request_messages";--> statement-breakpoint
CREATE POLICY "client_request_messages_internal_write" ON "client_request_messages"
	USING (app_is_internal_write())
	WITH CHECK (app_is_internal_write());--> statement-breakpoint
ALTER TABLE "client_timeline_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_timeline_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "client_timeline_events_tenant" ON "client_timeline_events";--> statement-breakpoint
CREATE POLICY "client_timeline_events_tenant" ON "client_timeline_events"
	USING (app_access_mode() = 'tenant' AND client_record_id IS NOT NULL AND client_record_id = app_current_tenant_id())
	WITH CHECK (app_access_mode() = 'tenant' AND client_record_id IS NOT NULL AND client_record_id = app_current_tenant_id());--> statement-breakpoint
DROP POLICY IF EXISTS "client_timeline_events_internal_aggregate" ON "client_timeline_events";--> statement-breakpoint
CREATE POLICY "client_timeline_events_internal_aggregate" ON "client_timeline_events"
	FOR SELECT
	USING (app_is_internal_aggregate());--> statement-breakpoint
DROP POLICY IF EXISTS "client_timeline_events_internal_write" ON "client_timeline_events";--> statement-breakpoint
CREATE POLICY "client_timeline_events_internal_write" ON "client_timeline_events"
	USING (app_is_internal_write())
	WITH CHECK (app_is_internal_write());--> statement-breakpoint
ALTER TABLE "monthly_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "monthly_reports" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "monthly_reports_tenant" ON "monthly_reports";--> statement-breakpoint
CREATE POLICY "monthly_reports_tenant" ON "monthly_reports"
	USING (app_access_mode() = 'tenant' AND client_record_id IS NOT NULL AND client_record_id = app_current_tenant_id())
	WITH CHECK (app_access_mode() = 'tenant' AND client_record_id IS NOT NULL AND client_record_id = app_current_tenant_id());--> statement-breakpoint
DROP POLICY IF EXISTS "monthly_reports_internal_aggregate" ON "monthly_reports";--> statement-breakpoint
CREATE POLICY "monthly_reports_internal_aggregate" ON "monthly_reports"
	FOR SELECT
	USING (app_is_internal_aggregate());--> statement-breakpoint
DROP POLICY IF EXISTS "monthly_reports_internal_write" ON "monthly_reports";--> statement-breakpoint
CREATE POLICY "monthly_reports_internal_write" ON "monthly_reports"
	USING (app_is_internal_write())
	WITH CHECK (app_is_internal_write());--> statement-breakpoint
ALTER TABLE "monthly_report_audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "monthly_report_audit_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "monthly_report_audit_logs_tenant" ON "monthly_report_audit_logs";--> statement-breakpoint
CREATE POLICY "monthly_report_audit_logs_tenant" ON "monthly_report_audit_logs"
	USING (app_access_mode() = 'tenant' AND client_record_id IS NOT NULL AND client_record_id = app_current_tenant_id())
	WITH CHECK (app_access_mode() = 'tenant' AND client_record_id IS NOT NULL AND client_record_id = app_current_tenant_id());--> statement-breakpoint
DROP POLICY IF EXISTS "monthly_report_audit_logs_internal_aggregate" ON "monthly_report_audit_logs";--> statement-breakpoint
CREATE POLICY "monthly_report_audit_logs_internal_aggregate" ON "monthly_report_audit_logs"
	FOR SELECT
	USING (app_is_internal_aggregate());--> statement-breakpoint
DROP POLICY IF EXISTS "monthly_report_audit_logs_internal_write" ON "monthly_report_audit_logs";--> statement-breakpoint
CREATE POLICY "monthly_report_audit_logs_internal_write" ON "monthly_report_audit_logs"
	USING (app_is_internal_write())
	WITH CHECK (app_is_internal_write());
