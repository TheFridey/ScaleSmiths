ALTER TABLE "client_requests" ADD COLUMN "client_record_id" integer;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD COLUMN "client_record_id" integer;--> statement-breakpoint
ALTER TABLE "monthly_report_audit_logs" ADD COLUMN "client_record_id" integer;--> statement-breakpoint
UPDATE "client_requests" AS request SET "client_record_id" = client."id" FROM "clients" AS client WHERE client."portal_client_id" = request."client_id";--> statement-breakpoint
UPDATE "monthly_reports" AS report SET "client_record_id" = client."id" FROM "clients" AS client WHERE client."portal_client_id" = report."client_id";--> statement-breakpoint
UPDATE "monthly_report_audit_logs" AS log SET "client_record_id" = client."id" FROM "clients" AS client WHERE client."portal_client_id" = log."client_id";--> statement-breakpoint
UPDATE "client_timeline_events" AS event SET "client_record_id" = client."id" FROM "clients" AS client WHERE event."client_record_id" IS NULL AND client."portal_client_id" = event."client_id";--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_client_record_id_clients_id_fk" FOREIGN KEY ("client_record_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_client_record_id_clients_id_fk" FOREIGN KEY ("client_record_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_report_audit_logs" ADD CONSTRAINT "monthly_report_audit_logs_client_record_id_clients_id_fk" FOREIGN KEY ("client_record_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_requests_client_record_idx" ON "client_requests" USING btree ("client_record_id");--> statement-breakpoint
CREATE INDEX "monthly_reports_client_record_idx" ON "monthly_reports" USING btree ("client_record_id");--> statement-breakpoint
CREATE INDEX "monthly_report_audit_client_record_idx" ON "monthly_report_audit_logs" USING btree ("client_record_id", "created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_fill_client_record_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF NEW.client_record_id IS NULL AND NEW.client_id IS NOT NULL THEN
		SELECT c.id INTO NEW.client_record_id
		FROM clients c
		WHERE c.portal_client_id = NEW.client_id;
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS client_requests_fill_client_record_id ON client_requests;--> statement-breakpoint
CREATE TRIGGER client_requests_fill_client_record_id
	BEFORE INSERT OR UPDATE OF client_id, client_record_id ON client_requests
	FOR EACH ROW
	EXECUTE FUNCTION app_fill_client_record_id();--> statement-breakpoint
DROP TRIGGER IF EXISTS monthly_reports_fill_client_record_id ON monthly_reports;--> statement-breakpoint
CREATE TRIGGER monthly_reports_fill_client_record_id
	BEFORE INSERT OR UPDATE OF client_id, client_record_id ON monthly_reports
	FOR EACH ROW
	EXECUTE FUNCTION app_fill_client_record_id();--> statement-breakpoint
DROP TRIGGER IF EXISTS monthly_report_audit_logs_fill_client_record_id ON monthly_report_audit_logs;--> statement-breakpoint
CREATE TRIGGER monthly_report_audit_logs_fill_client_record_id
	BEFORE INSERT OR UPDATE OF client_id, client_record_id ON monthly_report_audit_logs
	FOR EACH ROW
	EXECUTE FUNCTION app_fill_client_record_id();--> statement-breakpoint
DROP TRIGGER IF EXISTS client_timeline_events_fill_client_record_id ON client_timeline_events;--> statement-breakpoint
CREATE TRIGGER client_timeline_events_fill_client_record_id
	BEFORE INSERT OR UPDATE OF client_id, client_record_id ON client_timeline_events
	FOR EACH ROW
	EXECUTE FUNCTION app_fill_client_record_id();
