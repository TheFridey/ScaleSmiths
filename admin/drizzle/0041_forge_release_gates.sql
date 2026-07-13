DO $$ BEGIN
 CREATE TYPE "public"."forge_release_gate_decision_kind" AS ENUM('approved', 'override', 'revoked');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS "forge_release_gate_decisions" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer NOT NULL,
  "candidate_id" integer NOT NULL,
  "candidate_workspace_hash" text NOT NULL,
  "gate_key" text NOT NULL,
  "decision" "forge_release_gate_decision_kind" NOT NULL,
  "actor_id" text NOT NULL,
  "actor_role" text NOT NULL,
  "reason" text NOT NULL,
  "decided_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "forge_release_gate_decisions_project_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade,
  CONSTRAINT "forge_release_gate_decisions_candidate_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."forge_deployment_candidates"("id") ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "forge_release_gate_decisions_candidate_gate_idx" ON "forge_release_gate_decisions" ("candidate_id", "gate_key");
CREATE INDEX IF NOT EXISTS "forge_release_gate_decisions_project_idx" ON "forge_release_gate_decisions" ("project_id", "candidate_id");
