CREATE TYPE "public"."forge_task_result_quality" AS ENUM('validated', 'degraded', 'fallback', 'requires_review', 'failed');
ALTER TABLE "forge_tasks" ADD COLUMN "result_quality" "forge_task_result_quality" DEFAULT 'requires_review' NOT NULL;
ALTER TABLE "forge_tasks" ADD COLUMN "fallback_reason" text;
ALTER TABLE "forge_tasks" ADD COLUMN "provider_attempted" text;
ALTER TABLE "forge_tasks" ADD COLUMN "model_attempted" text;
ALTER TABLE "forge_tasks" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "forge_tasks" ADD COLUMN "validation_result" jsonb;
ALTER TABLE "forge_tasks" ADD COLUMN "quality_score" numeric(5,2);
ALTER TABLE "forge_tasks" ADD COLUMN "downstream_allowed" boolean DEFAULT false NOT NULL;
ALTER TABLE "forge_tasks" ADD COLUMN "human_approval_required" boolean DEFAULT true NOT NULL;
ALTER TABLE "forge_tasks" ADD COLUMN "publication_blocked" boolean DEFAULT true NOT NULL;
ALTER TABLE "forge_tasks" ADD COLUMN "quality_approved_by" text;
ALTER TABLE "forge_tasks" ADD COLUMN "quality_approved_at" timestamp with time zone;
ALTER TABLE "forge_tasks" ADD COLUMN "quality_approval_reason" text;

UPDATE "forge_tasks" SET
  "provider_attempted" = NULLIF("output_json" #>> '{ai,provider}', ''),
  "model_attempted" = NULLIF("output_json" #>> '{ai,model}', ''),
  "retry_count" = COALESCE(("output_json" #>> '{ai,retries}')::integer, 0),
  "result_quality" = CASE
    WHEN "status" = 'failed' THEN 'failed'::"forge_task_result_quality"
    WHEN "status" = 'completed' AND "output_json" #>> '{ai,provider}' = 'mock' THEN 'fallback'::"forge_task_result_quality"
    ELSE 'requires_review'::"forge_task_result_quality" END,
  "fallback_reason" = CASE WHEN "status" = 'completed' AND "output_json" #>> '{ai,provider}' = 'mock' THEN 'Historical task used deterministic mock output.' ELSE NULL END,
  "downstream_allowed" = CASE WHEN "status" = 'completed' THEN true ELSE false END,
  "human_approval_required" = CASE WHEN "status" = 'failed' THEN false ELSE true END,
  "publication_blocked" = true;

CREATE INDEX "forge_tasks_project_result_quality_idx" ON "forge_tasks" USING btree ("project_id", "result_quality");

CREATE FUNCTION "sync_forge_task_quality_metadata"() RETURNS trigger AS $$
BEGIN
  NEW."provider_attempted" := COALESCE(NEW."provider_attempted", NULLIF(NEW."output_json" #>> '{quality,providerAttempted}', ''), NULLIF(NEW."output_json" #>> '{ai,provider}', ''));
  NEW."model_attempted" := COALESCE(NEW."model_attempted", NULLIF(NEW."output_json" #>> '{quality,modelAttempted}', ''), NULLIF(NEW."output_json" #>> '{ai,model}', ''));
  NEW."retry_count" := COALESCE((NEW."output_json" #>> '{quality,retryCount}')::integer, (NEW."output_json" #>> '{ai,retries}')::integer, NEW."retry_count", 0);
  IF NEW."status" = 'failed' THEN
    NEW."result_quality" := 'failed'; NEW."publication_blocked" := true; NEW."downstream_allowed" := false;
  ELSIF NEW."status" = 'completed' AND (NEW."provider_attempted" = 'mock' OR NEW."output_json" #>> '{quality,resultQuality}' = 'fallback') THEN
    NEW."result_quality" := 'fallback'; NEW."fallback_reason" := COALESCE(NEW."fallback_reason", NEW."output_json" #>> '{quality,fallbackReason}', 'Deterministic mock provider output was used.'); NEW."publication_blocked" := true; NEW."human_approval_required" := true; NEW."downstream_allowed" := true;
  ELSIF NEW."status" = 'completed' AND NEW."result_quality" = 'requires_review' THEN
    NEW."publication_blocked" := true; NEW."human_approval_required" := true; NEW."downstream_allowed" := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "forge_task_quality_metadata_trigger" BEFORE INSERT OR UPDATE OF "status", "output_json" ON "forge_tasks" FOR EACH ROW EXECUTE FUNCTION "sync_forge_task_quality_metadata"();
