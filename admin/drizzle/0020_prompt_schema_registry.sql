ALTER TABLE "forge_tasks" ADD COLUMN "prompt_identifier" text DEFAULT 'forge.legacy' NOT NULL;
ALTER TABLE "forge_tasks" ADD COLUMN "prompt_version" text DEFAULT 'legacy' NOT NULL;
ALTER TABLE "forge_tasks" ADD COLUMN "schema_identifier" text DEFAULT 'forge.legacy' NOT NULL;
ALTER TABLE "forge_tasks" ADD COLUMN "schema_version" text DEFAULT 'legacy' NOT NULL;
ALTER TABLE "forge_artifacts" ADD COLUMN "prompt_identifier" text DEFAULT 'forge.legacy' NOT NULL;
ALTER TABLE "forge_artifacts" ADD COLUMN "schema_identifier" text DEFAULT 'forge.legacy' NOT NULL;
UPDATE "forge_artifacts" SET
  "prompt_identifier" = COALESCE("metadata_json" #>> '{registry,promptIdentifier}', 'forge.legacy'),
  "prompt_version" = COALESCE("metadata_json" #>> '{registry,promptVersion}', "prompt_version"),
  "schema_identifier" = COALESCE("metadata_json" #>> '{registry,schemaIdentifier}', 'forge.legacy'),
  "schema_version" = COALESCE("metadata_json" #>> '{registry,schemaVersion}', "schema_version");
UPDATE "forge_tasks" SET
  "prompt_identifier" = COALESCE("output_json" #>> '{registry,promptIdentifier}', 'forge.' || "agent_type"::text),
  "prompt_version" = COALESCE("output_json" #>> '{registry,promptVersion}', 'legacy'),
  "schema_identifier" = COALESCE("output_json" #>> '{registry,schemaIdentifier}', 'forge.' || "agent_type"::text || '.output'),
  "schema_version" = COALESCE("output_json" #>> '{registry,schemaVersion}', 'legacy');
CREATE FUNCTION "sync_forge_task_registry_refs"() RETURNS trigger AS $$
BEGIN
  NEW."prompt_identifier" := COALESCE(NEW."output_json" #>> '{registry,promptIdentifier}', NEW."prompt_identifier", 'forge.' || NEW."agent_type"::text);
  NEW."prompt_version" := COALESCE(NEW."output_json" #>> '{registry,promptVersion}', NEW."prompt_version", 'legacy');
  NEW."schema_identifier" := COALESCE(NEW."output_json" #>> '{registry,schemaIdentifier}', NEW."schema_identifier", 'forge.' || NEW."agent_type"::text || '.output');
  NEW."schema_version" := COALESCE(NEW."output_json" #>> '{registry,schemaVersion}', NEW."schema_version", 'legacy');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "forge_task_registry_refs_trigger" BEFORE INSERT OR UPDATE OF "output_json" ON "forge_tasks" FOR EACH ROW EXECUTE FUNCTION "sync_forge_task_registry_refs"();
CREATE FUNCTION "sync_forge_artifact_registry_refs"() RETURNS trigger AS $$
BEGIN
  NEW."prompt_identifier" := COALESCE(NEW."metadata_json" #>> '{registry,promptIdentifier}', NEW."prompt_identifier", 'forge.legacy');
  NEW."prompt_version" := COALESCE(NEW."metadata_json" #>> '{registry,promptVersion}', NEW."prompt_version", 'legacy');
  NEW."schema_identifier" := COALESCE(NEW."metadata_json" #>> '{registry,schemaIdentifier}', NEW."schema_identifier", 'forge.legacy');
  NEW."schema_version" := COALESCE(NEW."metadata_json" #>> '{registry,schemaVersion}', NEW."schema_version", 'legacy');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "forge_artifact_registry_refs_trigger" BEFORE INSERT OR UPDATE OF "metadata_json" ON "forge_artifacts" FOR EACH ROW EXECUTE FUNCTION "sync_forge_artifact_registry_refs"();
