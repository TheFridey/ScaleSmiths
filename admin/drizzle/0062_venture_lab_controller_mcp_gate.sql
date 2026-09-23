ALTER TYPE "admin_user_role" ADD VALUE IF NOT EXISTS 'venture_controller';
--> statement-breakpoint

CREATE TABLE "venture_opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" integer NOT NULL,
  "title" text NOT NULL,
  "problem" text NOT NULL,
  "status" text DEFAULT 'DISCOVERED' NOT NULL,
  "created_by_service" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_opportunities_status_check" CHECK ("status" IN ('DISCOVERED','RESEARCHING','PROPOSED','VALIDATING','KILL','SCALE'))
);
--> statement-breakpoint
ALTER TABLE "venture_opportunities" ADD CONSTRAINT "venture_opportunities_experiment_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_opportunities" ADD CONSTRAINT "venture_opportunities_service_fk" FOREIGN KEY ("created_by_service") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_opportunities_experiment_status_idx" ON "venture_opportunities" ("experiment_id","status");
--> statement-breakpoint

CREATE TABLE "venture_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" integer NOT NULL,
  "opportunity_id" uuid,
  "source_url" text NOT NULL,
  "source_title" text NOT NULL,
  "evidence_type" text NOT NULL,
  "claim" text NOT NULL,
  "summary" text NOT NULL,
  "excerpt" text NOT NULL,
  "published_at" timestamp with time zone,
  "observed_at" timestamp with time zone NOT NULL,
  "content_hash" text NOT NULL,
  "captured_by_service" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_evidence_excerpt_check" CHECK (char_length("excerpt") <= 1000),
  CONSTRAINT "venture_evidence_hash_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "venture_evidence" ADD CONSTRAINT "venture_evidence_experiment_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_evidence" ADD CONSTRAINT "venture_evidence_opportunity_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."venture_opportunities"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_evidence" ADD CONSTRAINT "venture_evidence_service_fk" FOREIGN KEY ("captured_by_service") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_evidence_content_hash_idx" ON "venture_evidence" ("experiment_id","content_hash");
--> statement-breakpoint
CREATE INDEX "venture_evidence_opportunity_created_idx" ON "venture_evidence" ("opportunity_id","created_at");
--> statement-breakpoint

CREATE TABLE "venture_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" integer NOT NULL,
  "opportunity_id" uuid,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "rationale" text NOT NULL,
  "payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "proposed_by_service" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_proposals_kind_check" CHECK ("kind" IN ('OPPORTUNITY','EXPERIMENT','DECISION')),
  CONSTRAINT "venture_proposals_status_check" CHECK ("status" IN ('PENDING','ACCEPTED','REJECTED','CANCELLED'))
);
--> statement-breakpoint
ALTER TABLE "venture_proposals" ADD CONSTRAINT "venture_proposals_experiment_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_proposals" ADD CONSTRAINT "venture_proposals_opportunity_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."venture_opportunities"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_proposals" ADD CONSTRAINT "venture_proposals_service_fk" FOREIGN KEY ("proposed_by_service") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_proposals_experiment_status_idx" ON "venture_proposals" ("experiment_id","status","created_at");
--> statement-breakpoint

CREATE TABLE "venture_control_state" (
  "experiment_id" integer PRIMARY KEY NOT NULL,
  "current_blocker" text NOT NULL,
  "next_decision" text NOT NULL,
  "updated_by_user" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venture_control_state" ADD CONSTRAINT "venture_control_state_experiment_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_control_state" ADD CONSTRAINT "venture_control_state_user_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."admin_users"("id") ON DELETE SET NULL;
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
    IF approver_active IS DISTINCT FROM true OR approver_role <> 'venture_controller' THEN
      RAISE EXCEPTION 'Venture Lab financial approval requires an active Venture Controller identity';
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
--> statement-breakpoint

INSERT INTO "venture_control_state" ("experiment_id","current_blocker","next_decision")
SELECT "id",
  'Grok connection remains blocked pending restricted MCP connection-readiness approval.',
  'Nova + Trev decide whether the Grok Venture Director may connect to Experiment #000.'
FROM "venture_experiments"
WHERE "code" = 'EXP-000'
ON CONFLICT ("experiment_id") DO NOTHING;
