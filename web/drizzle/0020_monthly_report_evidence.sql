ALTER TABLE "monthly_reports" ADD COLUMN "version" integer;
ALTER TABLE "monthly_reports" ADD COLUMN "source_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "monthly_reports" ADD COLUMN "reviewed_at" timestamp with time zone;
ALTER TABLE "monthly_reports" ADD COLUMN "reviewed_by" text;
ALTER TABLE "monthly_reports" ADD COLUMN "published_by" text;

WITH numbered AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "client_id", "year", "month"
    ORDER BY "created_at", "id"
  ) AS "report_version"
  FROM "monthly_reports"
)
UPDATE "monthly_reports"
SET "version" = numbered."report_version"
FROM numbered
WHERE "monthly_reports"."id" = numbered."id";

ALTER TABLE "monthly_reports" ALTER COLUMN "version" SET DEFAULT 1;
ALTER TABLE "monthly_reports" ALTER COLUMN "version" SET NOT NULL;
CREATE UNIQUE INDEX "monthly_reports_period_version_idx" ON "monthly_reports" USING btree ("client_id", "year", "month", "version");

CREATE TABLE "monthly_report_audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "report_id" integer NOT NULL,
  "client_id" text NOT NULL,
  "action" text NOT NULL,
  "actor" text NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "monthly_report_audit_logs" ADD CONSTRAINT "monthly_report_audit_logs_report_id_monthly_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."monthly_reports"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "monthly_report_audit_report_idx" ON "monthly_report_audit_logs" USING btree ("report_id", "created_at");
CREATE INDEX "monthly_report_audit_client_idx" ON "monthly_report_audit_logs" USING btree ("client_id", "created_at");

CREATE OR REPLACE FUNCTION prevent_published_monthly_report_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'published monthly reports are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_reports_published_immutable_update
BEFORE UPDATE ON "monthly_reports"
FOR EACH ROW EXECUTE FUNCTION prevent_published_monthly_report_mutation();

CREATE TRIGGER monthly_reports_published_immutable_delete
BEFORE DELETE ON "monthly_reports"
FOR EACH ROW EXECUTE FUNCTION prevent_published_monthly_report_mutation();
