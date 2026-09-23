ALTER TYPE "admin_user_role" ADD VALUE IF NOT EXISTS 'venture_controller';
--> statement-breakpoint

ALTER TABLE "venture_service_accounts"
ADD COLUMN "scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "venture_service_accounts"
ADD CONSTRAINT "venture_service_accounts_scopes_check"
CHECK ("scopes" <@ ARRAY[
  'status:read',
  'opportunities:read',
  'opportunities:propose',
  'evidence:read',
  'evidence:propose',
  'experiments:read',
  'approvals:read',
  'ledger:read',
  'audit:read',
  'proposals:create'
]::text[]);
--> statement-breakpoint

CREATE TABLE "venture_service_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_account_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "token_version" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_service_credentials_hash_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "venture_service_credentials_version_check" CHECK ("token_version" > 0),
  CONSTRAINT "venture_service_credentials_state_check" CHECK (
    ("active" = true AND "revoked_at" IS NULL)
    OR
    ("active" = false AND "revoked_at" IS NOT NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "venture_service_credentials"
ADD CONSTRAINT "venture_service_credentials_service_fk"
FOREIGN KEY ("service_account_id") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_service_credentials_service_version_idx"
ON "venture_service_credentials" ("service_account_id","token_version");
--> statement-breakpoint

CREATE TABLE "venture_opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" integer,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "status" text DEFAULT 'PROPOSED' NOT NULL,
  "proposed_by_service" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_opportunities_status_check" CHECK ("status" IN ('PROPOSED','RESEARCHING','VALIDATION_CANDIDATE','ARCHIVED'))
);
--> statement-breakpoint
ALTER TABLE "venture_opportunities"
ADD CONSTRAINT "venture_opportunities_experiment_fk"
FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_opportunities"
ADD CONSTRAINT "venture_opportunities_service_fk"
FOREIGN KEY ("proposed_by_service") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_opportunities_experiment_created_idx"
ON "venture_opportunities" ("experiment_id","created_at");
--> statement-breakpoint

CREATE TABLE "venture_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" integer,
  "opportunity_id" uuid,
  "source_url" text,
  "source_title" text,
  "evidence_type" text NOT NULL,
  "claim" text NOT NULL,
  "summary" text NOT NULL,
  "excerpt" text,
  "observed_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "content_hash" text NOT NULL,
  "status" text DEFAULT 'PROPOSED' NOT NULL,
  "submitted_by_service" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_evidence_hash_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "venture_evidence_excerpt_check" CHECK ("excerpt" IS NULL OR length("excerpt") <= 1000),
  CONSTRAINT "venture_evidence_status_check" CHECK ("status" IN ('PROPOSED','ACCEPTED','REJECTED'))
);
--> statement-breakpoint
ALTER TABLE "venture_evidence"
ADD CONSTRAINT "venture_evidence_experiment_fk"
FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_evidence"
ADD CONSTRAINT "venture_evidence_opportunity_fk"
FOREIGN KEY ("opportunity_id") REFERENCES "public"."venture_opportunities"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_evidence"
ADD CONSTRAINT "venture_evidence_service_fk"
FOREIGN KEY ("submitted_by_service") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_evidence_experiment_created_idx"
ON "venture_evidence" ("experiment_id","created_at");
--> statement-breakpoint
CREATE INDEX "venture_evidence_opportunity_created_idx"
ON "venture_evidence" ("opportunity_id","created_at");
--> statement-breakpoint

CREATE TABLE "venture_agent_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" integer,
  "proposal_type" text NOT NULL,
  "title" text NOT NULL,
  "rationale" text NOT NULL,
  "payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "requested_by_service" text NOT NULL,
  "status" text DEFAULT 'PROPOSED' NOT NULL,
  "resolved_by" uuid,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_agent_proposals_type_check" CHECK ("proposal_type" IN ('OPPORTUNITY','EXPERIMENT','SPEND','LAUNCH','OTHER')),
  CONSTRAINT "venture_agent_proposals_status_check" CHECK ("status" IN ('PROPOSED','ACCEPTED','REJECTED','CANCELLED')),
  CONSTRAINT "venture_agent_proposals_resolution_check" CHECK (
    ("status" = 'PROPOSED' AND "resolved_by" IS NULL AND "resolved_at" IS NULL)
    OR
    ("status" <> 'PROPOSED' AND "resolved_by" IS NOT NULL AND "resolved_at" IS NOT NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "venture_agent_proposals"
ADD CONSTRAINT "venture_agent_proposals_experiment_fk"
FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_agent_proposals"
ADD CONSTRAINT "venture_agent_proposals_service_fk"
FOREIGN KEY ("requested_by_service") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_agent_proposals"
ADD CONSTRAINT "venture_agent_proposals_resolved_by_fk"
FOREIGN KEY ("resolved_by") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_agent_proposals_experiment_created_idx"
ON "venture_agent_proposals" ("experiment_id","created_at");
--> statement-breakpoint
CREATE INDEX "venture_agent_proposals_status_created_idx"
ON "venture_agent_proposals" ("status","created_at");
--> statement-breakpoint

CREATE TABLE "venture_gate_state" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "current_blocker" text NOT NULL,
  "next_decision" text NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_gate_state_singleton_check" CHECK ("id" = 1)
);
--> statement-breakpoint
ALTER TABLE "venture_gate_state"
ADD CONSTRAINT "venture_gate_state_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
INSERT INTO "venture_gate_state" ("id","current_blocker","next_decision")
VALUES (
  1,
  'Restricted MCP boundary is not yet approved for Grok connection.',
  'Nova + Trev decide whether the Grok Venture Director may connect to Experiment #000.'
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_service_account"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab service accounts cannot be deleted';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
    OR OLD.scopes IS DISTINCT FROM NEW.scopes
  THEN
    RAISE EXCEPTION 'Venture Lab service account identity and scopes are immutable';
  END IF;
  IF OLD.active = false AND NEW.active = true THEN
    RAISE EXCEPTION 'Revoked Venture Lab service accounts cannot be reactivated';
  END IF;
  IF OLD.active = true AND NEW.active = false THEN
    IF NEW.revoked_at IS NULL OR NEW.token_version <= OLD.token_version THEN
      RAISE EXCEPTION 'Service-account revocation must timestamp revocation and advance token version';
    END IF;
  ELSIF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.token_version IS DISTINCT FROM OLD.token_version THEN
    RAISE EXCEPTION 'Service-account security state may change only during revocation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_service_credential"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab service credentials cannot be deleted';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.service_account_id IS DISTINCT FROM NEW.service_account_id
    OR OLD.token_hash IS DISTINCT FROM NEW.token_hash
    OR OLD.token_version IS DISTINCT FROM NEW.token_version
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'Venture Lab service credential identity is immutable';
  END IF;
  IF OLD.active = false AND NEW.active = true THEN
    RAISE EXCEPTION 'Revoked Venture Lab credentials cannot be reactivated';
  END IF;
  IF OLD.active = true AND NEW.active = false THEN
    IF NEW.revoked_at IS NULL THEN
      RAISE EXCEPTION 'Credential revocation requires a timestamp';
    END IF;
  ELSIF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'Credential revocation state is immutable outside revocation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_service_credentials_guard"
BEFORE UPDATE OR DELETE ON "venture_service_credentials"
FOR EACH ROW EXECUTE FUNCTION "venture_guard_service_credential"();
--> statement-breakpoint

CREATE TRIGGER "venture_opportunities_append_only"
BEFORE UPDATE OR DELETE ON "venture_opportunities"
FOR EACH ROW EXECUTE FUNCTION "venture_reject_history_mutation"();
--> statement-breakpoint
CREATE TRIGGER "venture_evidence_append_only"
BEFORE UPDATE OR DELETE ON "venture_evidence"
FOR EACH ROW EXECUTE FUNCTION "venture_reject_history_mutation"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_agent_proposal"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  resolver_role text;
  resolver_active boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab agent proposals cannot be deleted';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.experiment_id IS DISTINCT FROM NEW.experiment_id
    OR OLD.proposal_type IS DISTINCT FROM NEW.proposal_type
    OR OLD.title IS DISTINCT FROM NEW.title
    OR OLD.rationale IS DISTINCT FROM NEW.rationale
    OR OLD.payload_json IS DISTINCT FROM NEW.payload_json
    OR OLD.requested_by_service IS DISTINCT FROM NEW.requested_by_service
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'Venture Lab proposal payload is immutable';
  END IF;

  IF OLD.status <> 'PROPOSED' OR NEW.status NOT IN ('ACCEPTED','REJECTED','CANCELLED')
    OR NEW.resolved_by IS NULL OR NEW.resolved_at IS NULL
  THEN
    RAISE EXCEPTION 'Invalid Venture Lab proposal resolution';
  END IF;

  SELECT role::text, active
    INTO resolver_role, resolver_active
    FROM admin_users
    WHERE id = NEW.resolved_by;
  IF resolver_active IS DISTINCT FROM true
    OR resolver_role NOT IN ('owner','administrator','venture_controller')
  THEN
    RAISE EXCEPTION 'Venture Lab proposal resolution requires an active authoritative human identity';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_agent_proposals_guard"
BEFORE UPDATE OR DELETE ON "venture_agent_proposals"
FOR EACH ROW EXECUTE FUNCTION "venture_guard_agent_proposal"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_gate_state"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  updater_role text;
  updater_active boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab gate state cannot be deleted';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Venture Lab gate-state identity is immutable';
  END IF;
  IF NEW.updated_by IS NULL THEN
    RAISE EXCEPTION 'Venture Lab gate-state changes require an authenticated human';
  END IF;
  SELECT role::text, active
    INTO updater_role, updater_active
    FROM admin_users
    WHERE id = NEW.updated_by;
  IF updater_active IS DISTINCT FROM true
    OR updater_role NOT IN ('owner','administrator','venture_controller')
  THEN
    RAISE EXCEPTION 'Venture Lab gate-state changes require an active authoritative human identity';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_gate_state_guard"
BEFORE UPDATE OR DELETE ON "venture_gate_state"
FOR EACH ROW EXECUTE FUNCTION "venture_guard_gate_state"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_approval_request"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  approver_role text;
  approver_active boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab approval requests cannot be deleted';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.experiment_id IS DISTINCT FROM NEW.experiment_id
    OR OLD.action IS DISTINCT FROM NEW.action
    OR OLD.amount_minor IS DISTINCT FROM NEW.amount_minor
    OR OLD.currency IS DISTINCT FROM NEW.currency
    OR OLD.target IS DISTINCT FROM NEW.target
    OR OLD.purpose IS DISTINCT FROM NEW.purpose
    OR OLD.payload_hash IS DISTINCT FROM NEW.payload_hash
    OR OLD.payload_json IS DISTINCT FROM NEW.payload_json
    OR OLD.request_idempotency_key IS DISTINCT FROM NEW.request_idempotency_key
    OR OLD.requested_by_service IS DISTINCT FROM NEW.requested_by_service
    OR OLD.requested_at IS DISTINCT FROM NEW.requested_at
    OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
  THEN
    RAISE EXCEPTION 'Venture Lab approval payload is immutable';
  END IF;

  IF OLD.status = 'REQUESTED' AND NEW.status = 'APPROVED' THEN
    IF NEW.approved_by IS NULL OR NEW.approved_at IS NULL OR NEW.expires_at <= CURRENT_TIMESTAMP OR NEW.consumed_at IS NOT NULL OR NEW.resolved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid Venture Lab approval transition';
    END IF;
    SELECT role::text, active INTO approver_role, approver_active FROM admin_users WHERE id = NEW.approved_by;
    IF approver_active IS DISTINCT FROM true OR approver_role NOT IN ('owner','administrator','venture_controller') THEN
      RAISE EXCEPTION 'Venture Lab financial approval requires an active authoritative human identity';
    END IF;
  ELSIF OLD.status = 'REQUESTED' AND NEW.status IN ('REJECTED','CANCELLED') THEN
    IF NEW.resolved_at IS NULL OR NEW.consumed_at IS NOT NULL OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid Venture Lab terminal approval transition';
    END IF;
  ELSIF OLD.status = 'REQUESTED' AND NEW.status = 'EXPIRED' THEN
    IF NEW.expires_at > CURRENT_TIMESTAMP OR NEW.resolved_at IS NULL OR NEW.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid Venture Lab expiry transition';
    END IF;
  ELSIF OLD.status = 'APPROVED' AND NEW.status = 'CONSUMED' THEN
    IF NEW.expires_at <= CURRENT_TIMESTAMP OR NEW.consumed_at IS NULL OR NEW.resolved_at IS NULL OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Invalid or expired Venture Lab approval consumption';
    END IF;
  ELSIF OLD.status = 'APPROVED' AND NEW.status IN ('CANCELLED','EXPIRED') THEN
    IF NEW.resolved_at IS NULL OR NEW.consumed_at IS NOT NULL OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Invalid Venture Lab approved-request terminal transition';
    END IF;
    IF NEW.status = 'EXPIRED' AND NEW.expires_at > CURRENT_TIMESTAMP THEN
      RAISE EXCEPTION 'Venture Lab approval is not expired';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid Venture Lab approval state transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;
