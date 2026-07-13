DO $$ BEGIN
 CREATE TYPE "public"."forge_deployment_candidate_state" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'superseded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS "forge_deployment_candidates" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer NOT NULL,
  "candidate_number" integer NOT NULL,
  "parent_candidate_id" integer,
  "state" "forge_deployment_candidate_state" DEFAULT 'draft' NOT NULL,
  "workspace_version" text NOT NULL,
  "workspace_path" text NOT NULL,
  "workspace_hash" text NOT NULL,
  "repository_commit" text,
  "approved_artifacts_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "evidence_json" jsonb NOT NULL,
  "fallback_dependencies_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "environment_requirements_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "migration_requirements_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "release_notes" text NOT NULL,
  "rollback_plan" text NOT NULL,
  "created_by" text NOT NULL,
  "submitted_by" text,
  "submitted_at" timestamp with time zone,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "approval_reason" text,
  "rejected_by" text,
  "rejected_at" timestamp with time zone,
  "rejection_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "forge_deployment_candidates_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade,
  CONSTRAINT "forge_deployment_candidates_parent_id_fk" FOREIGN KEY ("parent_candidate_id") REFERENCES "public"."forge_deployment_candidates"("id") ON DELETE set null
);
CREATE UNIQUE INDEX IF NOT EXISTS "forge_deployment_candidates_project_number_idx" ON "forge_deployment_candidates" ("project_id", "candidate_number");
CREATE INDEX IF NOT EXISTS "forge_deployment_candidates_project_state_idx" ON "forge_deployment_candidates" ("project_id", "state");
CREATE INDEX IF NOT EXISTS "forge_deployment_candidates_parent_idx" ON "forge_deployment_candidates" ("parent_candidate_id");

CREATE OR REPLACE FUNCTION prevent_submitted_deployment_candidate_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.state IN ('submitted', 'approved', 'rejected', 'superseded') THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'submitted deployment candidates are immutable'; END IF;
    IF NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.candidate_number IS DISTINCT FROM OLD.candidate_number
      OR NEW.parent_candidate_id IS DISTINCT FROM OLD.parent_candidate_id
      OR NEW.workspace_version IS DISTINCT FROM OLD.workspace_version
      OR NEW.workspace_path IS DISTINCT FROM OLD.workspace_path
      OR NEW.workspace_hash IS DISTINCT FROM OLD.workspace_hash
      OR NEW.repository_commit IS DISTINCT FROM OLD.repository_commit
      OR NEW.approved_artifacts_json IS DISTINCT FROM OLD.approved_artifacts_json
      OR NEW.evidence_json IS DISTINCT FROM OLD.evidence_json
      OR NEW.fallback_dependencies_json IS DISTINCT FROM OLD.fallback_dependencies_json
      OR NEW.environment_requirements_json IS DISTINCT FROM OLD.environment_requirements_json
      OR NEW.migration_requirements_json IS DISTINCT FROM OLD.migration_requirements_json
      OR NEW.release_notes IS DISTINCT FROM OLD.release_notes
      OR NEW.rollback_plan IS DISTINCT FROM OLD.rollback_plan
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN RAISE EXCEPTION 'submitted deployment candidate snapshot is immutable'; END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS forge_deployment_candidate_immutable ON "forge_deployment_candidates";
CREATE TRIGGER forge_deployment_candidate_immutable BEFORE UPDATE OR DELETE ON "forge_deployment_candidates"
FOR EACH ROW EXECUTE FUNCTION prevent_submitted_deployment_candidate_mutation();
