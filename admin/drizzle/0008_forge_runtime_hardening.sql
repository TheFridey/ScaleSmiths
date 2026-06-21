ALTER TABLE "forge_artifacts" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "forge_artifacts" ADD COLUMN IF NOT EXISTS "superseded_at" timestamp with time zone;
ALTER TABLE "forge_artifacts" ADD COLUMN IF NOT EXISTS "retention_policy" text DEFAULT 'standard' NOT NULL;
ALTER TABLE "forge_artifacts" ADD COLUMN IF NOT EXISTS "content_bytes" integer DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS "forge_projects_status_idx" ON "forge_projects" ("status");
CREATE INDEX IF NOT EXISTS "forge_projects_priority_idx" ON "forge_projects" ("priority");
CREATE INDEX IF NOT EXISTS "forge_projects_updated_at_idx" ON "forge_projects" ("updated_at");

CREATE INDEX IF NOT EXISTS "forge_tasks_project_id_idx" ON "forge_tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "forge_tasks_project_status_idx" ON "forge_tasks" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "forge_tasks_project_agent_type_idx" ON "forge_tasks" ("project_id", "agent_type");
CREATE INDEX IF NOT EXISTS "forge_tasks_status_updated_at_idx" ON "forge_tasks" ("status", "updated_at");

CREATE INDEX IF NOT EXISTS "forge_artifacts_project_id_idx" ON "forge_artifacts" ("project_id");
CREATE INDEX IF NOT EXISTS "forge_artifacts_project_type_idx" ON "forge_artifacts" ("project_id", "type");
CREATE INDEX IF NOT EXISTS "forge_artifacts_project_type_title_idx" ON "forge_artifacts" ("project_id", "type", "title");
CREATE INDEX IF NOT EXISTS "forge_artifacts_version_idx" ON "forge_artifacts" ("project_id", "type", "title", "version");

CREATE INDEX IF NOT EXISTS "forge_integration_configs_project_id_idx" ON "forge_integration_configs" ("project_id");
CREATE INDEX IF NOT EXISTS "forge_integration_configs_project_provider_idx" ON "forge_integration_configs" ("project_id", "provider");
CREATE INDEX IF NOT EXISTS "forge_integration_configs_provider_idx" ON "forge_integration_configs" ("provider");

CREATE INDEX IF NOT EXISTS "forge_activity_logs_project_id_idx" ON "forge_activity_logs" ("project_id");
CREATE INDEX IF NOT EXISTS "forge_activity_logs_project_created_at_idx" ON "forge_activity_logs" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "forge_activity_logs_action_idx" ON "forge_activity_logs" ("action");

CREATE INDEX IF NOT EXISTS "forge_memories_project_id_idx" ON "forge_memories" ("project_id");
CREATE INDEX IF NOT EXISTS "forge_memories_project_key_idx" ON "forge_memories" ("project_id", "key");
