ALTER TABLE "forge_deployment_candidates" ADD COLUMN IF NOT EXISTS "dependency_report_json" jsonb;--> statement-breakpoint
ALTER TABLE "forge_deployment_candidates" ADD COLUMN IF NOT EXISTS "dependency_report_hash" text;--> statement-breakpoint
ALTER TABLE "forge_deployment_candidates" ADD COLUMN IF NOT EXISTS "dependency_sbom_json" jsonb;--> statement-breakpoint
ALTER TABLE "forge_deployment_candidates" ADD COLUMN IF NOT EXISTS "dependency_sbom_hash" text;--> statement-breakpoint
ALTER TABLE "forge_deployment_candidates" ADD COLUMN IF NOT EXISTS "dependency_package_json_hash" text;--> statement-breakpoint
ALTER TABLE "forge_deployment_candidates" ADD COLUMN IF NOT EXISTS "dependency_lockfile_hash" text;--> statement-breakpoint
ALTER TABLE "forge_deployment_candidates" ADD COLUMN IF NOT EXISTS "dependency_policy_version" text;--> statement-breakpoint
ALTER TABLE "forge_deployment_candidates" ADD COLUMN IF NOT EXISTS "dependency_evidence_created_at" timestamp with time zone;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "forge_deployment_candidates" ADD CONSTRAINT "forge_deployment_candidates_dependency_evidence_complete" CHECK (
    ("dependency_report_json" IS NULL AND "dependency_report_hash" IS NULL AND "dependency_sbom_json" IS NULL AND "dependency_sbom_hash" IS NULL AND "dependency_package_json_hash" IS NULL AND "dependency_lockfile_hash" IS NULL AND "dependency_policy_version" IS NULL AND "dependency_evidence_created_at" IS NULL)
    OR
    ("dependency_report_json" IS NOT NULL AND "dependency_report_hash" IS NOT NULL AND "dependency_sbom_json" IS NOT NULL AND "dependency_sbom_hash" IS NOT NULL AND "dependency_package_json_hash" IS NOT NULL AND "dependency_lockfile_hash" IS NOT NULL AND "dependency_policy_version" IS NOT NULL AND "dependency_evidence_created_at" IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "forge_deployment_candidates" ADD CONSTRAINT "forge_deployment_candidates_dependency_hashes_sha256" CHECK (
    "dependency_report_hash" IS NULL OR (
      "dependency_report_hash" ~ '^[0-9a-f]{64}$'
      AND "dependency_sbom_hash" ~ '^[0-9a-f]{64}$'
      AND "dependency_package_json_hash" ~ '^[0-9a-f]{64}$'
      AND "dependency_lockfile_hash" ~ '^[0-9a-f]{64}$'
    )
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

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
      OR NEW.dependency_report_json IS DISTINCT FROM OLD.dependency_report_json
      OR NEW.dependency_report_hash IS DISTINCT FROM OLD.dependency_report_hash
      OR NEW.dependency_sbom_json IS DISTINCT FROM OLD.dependency_sbom_json
      OR NEW.dependency_sbom_hash IS DISTINCT FROM OLD.dependency_sbom_hash
      OR NEW.dependency_package_json_hash IS DISTINCT FROM OLD.dependency_package_json_hash
      OR NEW.dependency_lockfile_hash IS DISTINCT FROM OLD.dependency_lockfile_hash
      OR NEW.dependency_policy_version IS DISTINCT FROM OLD.dependency_policy_version
      OR NEW.dependency_evidence_created_at IS DISTINCT FROM OLD.dependency_evidence_created_at
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
$$ LANGUAGE plpgsql;--> statement-breakpoint
