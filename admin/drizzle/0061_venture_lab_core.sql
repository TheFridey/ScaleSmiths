CREATE TABLE "venture_runtime_state" (
  "id" integer PRIMARY KEY NOT NULL DEFAULT 1,
  "paused" boolean DEFAULT false NOT NULL,
  "paused_at" timestamp with time zone,
  "paused_by" uuid,
  "pause_reason" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_runtime_state_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "venture_runtime_state_pause_check" CHECK (
    ("paused" = false AND "paused_at" IS NULL AND "paused_by" IS NULL AND "pause_reason" IS NULL)
    OR
    ("paused" = true AND "paused_at" IS NOT NULL AND "paused_by" IS NOT NULL AND length(trim("pause_reason")) > 0)
  )
);
--> statement-breakpoint
ALTER TABLE "venture_runtime_state" ADD CONSTRAINT "venture_runtime_state_paused_by_fk" FOREIGN KEY ("paused_by") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
INSERT INTO "venture_runtime_state" ("id","paused") VALUES (1,false) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

CREATE TABLE "venture_service_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "display_name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "revoked_at" timestamp with time zone,
  "token_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_service_accounts_token_version_check" CHECK ("token_version" > 0),
  CONSTRAINT "venture_service_accounts_revocation_check" CHECK (
    ("active" = true AND "revoked_at" IS NULL)
    OR
    ("active" = false AND "revoked_at" IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE TABLE "venture_experiments" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "mode" text DEFAULT 'SIMULATED' NOT NULL,
  "status" text DEFAULT 'PREPARING' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_experiments_mode_check" CHECK ("mode" IN ('SIMULATED','REAL')),
  CONSTRAINT "venture_experiments_status_check" CHECK ("status" IN ('PREPARING','RUNNING','PASSED','FAILED','BLOCKED','COMPLETE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_experiments_code_idx" ON "venture_experiments" ("code");
--> statement-breakpoint

CREATE TABLE "venture_budget_envelopes" (
  "id" serial PRIMARY KEY NOT NULL,
  "experiment_id" integer NOT NULL,
  "kind" text NOT NULL,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "allocated_minor" integer DEFAULT 0 NOT NULL,
  "reserved_minor" integer DEFAULT 0 NOT NULL,
  "spent_minor" integer DEFAULT 0 NOT NULL,
  "spendable" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_budget_envelopes_kind_check" CHECK ("kind" IN ('protected_reserve','experiment')),
  CONSTRAINT "venture_budget_envelopes_currency_check" CHECK ("currency" = 'GBP'),
  CONSTRAINT "venture_budget_envelopes_amount_check" CHECK ("allocated_minor" >= 0 AND "reserved_minor" >= 0 AND "spent_minor" >= 0),
  CONSTRAINT "venture_budget_envelopes_capacity_check" CHECK ("reserved_minor" + "spent_minor" <= "allocated_minor"),
  CONSTRAINT "venture_budget_envelopes_protected_check" CHECK (
    "kind" <> 'protected_reserve'
    OR ("spendable" = false AND "reserved_minor" = 0 AND "spent_minor" = 0)
  )
);
--> statement-breakpoint
ALTER TABLE "venture_budget_envelopes" ADD CONSTRAINT "venture_budget_envelopes_experiment_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_budget_envelopes_experiment_kind_idx" ON "venture_budget_envelopes" ("experiment_id","kind");
--> statement-breakpoint

CREATE TABLE "venture_approval_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" integer NOT NULL,
  "action" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "target" text NOT NULL,
  "purpose" text NOT NULL,
  "payload_hash" text NOT NULL,
  "payload_json" jsonb NOT NULL,
  "status" text DEFAULT 'REQUESTED' NOT NULL,
  "request_idempotency_key" text NOT NULL,
  "requested_by_service" text NOT NULL,
  "approved_by" uuid,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "approved_at" timestamp with time zone,
  "consumed_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "decision_reason" text,
  CONSTRAINT "venture_approval_requests_status_check" CHECK ("status" IN ('REQUESTED','APPROVED','REJECTED','EXPIRED','CANCELLED','CONSUMED')),
  CONSTRAINT "venture_approval_requests_amount_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "venture_approval_requests_currency_check" CHECK ("currency" = 'GBP'),
  CONSTRAINT "venture_approval_requests_expiry_check" CHECK ("expires_at" > "requested_at"),
  CONSTRAINT "venture_approval_requests_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "venture_approval_requests" ADD CONSTRAINT "venture_approval_requests_experiment_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_approval_requests" ADD CONSTRAINT "venture_approval_requests_service_fk" FOREIGN KEY ("requested_by_service") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_approval_requests" ADD CONSTRAINT "venture_approval_requests_approved_by_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_approval_requests_idempotency_idx" ON "venture_approval_requests" ("request_idempotency_key");
--> statement-breakpoint
CREATE INDEX "venture_approval_requests_status_expiry_idx" ON "venture_approval_requests" ("status","expires_at");
--> statement-breakpoint

CREATE TABLE "venture_approval_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "approval_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "actor_type" text NOT NULL,
  "actor_key" text NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_approval_events_actor_type_check" CHECK ("actor_type" IN ('human','service','system'))
);
--> statement-breakpoint
ALTER TABLE "venture_approval_events" ADD CONSTRAINT "venture_approval_events_approval_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."venture_approval_requests"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_approval_events_approval_created_idx" ON "venture_approval_events" ("approval_id","created_at");
--> statement-breakpoint

CREATE TABLE "venture_budget_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "envelope_id" integer NOT NULL,
  "approval_id" uuid NOT NULL,
  "requested_by_service" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "target" text NOT NULL,
  "purpose" text NOT NULL,
  "status" text DEFAULT 'RESERVED' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "settled_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  CONSTRAINT "venture_budget_reservations_amount_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "venture_budget_reservations_currency_check" CHECK ("currency" = 'GBP'),
  CONSTRAINT "venture_budget_reservations_status_check" CHECK ("status" IN ('RESERVED','SETTLED','RELEASED','EXPIRED')),
  CONSTRAINT "venture_budget_reservations_terminal_check" CHECK (
    ("status" = 'RESERVED' AND "settled_at" IS NULL AND "released_at" IS NULL)
    OR ("status" = 'SETTLED' AND "settled_at" IS NOT NULL AND "released_at" IS NULL)
    OR ("status" IN ('RELEASED','EXPIRED') AND "released_at" IS NOT NULL AND "settled_at" IS NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "venture_budget_reservations" ADD CONSTRAINT "venture_budget_reservations_envelope_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."venture_budget_envelopes"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_budget_reservations" ADD CONSTRAINT "venture_budget_reservations_approval_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."venture_approval_requests"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_budget_reservations" ADD CONSTRAINT "venture_budget_reservations_service_fk" FOREIGN KEY ("requested_by_service") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_budget_reservations_idempotency_idx" ON "venture_budget_reservations" ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_budget_reservations_approval_idx" ON "venture_budget_reservations" ("approval_id");
--> statement-breakpoint
CREATE INDEX "venture_budget_reservations_envelope_status_idx" ON "venture_budget_reservations" ("envelope_id","status");
--> statement-breakpoint

CREATE TABLE "venture_ledger_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_ledger_accounts_kind_check" CHECK ("kind" IN ('asset','liability','equity','revenue','expense')),
  CONSTRAINT "venture_ledger_accounts_currency_check" CHECK ("currency" = 'GBP')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_ledger_accounts_code_idx" ON "venture_ledger_accounts" ("code");
--> statement-breakpoint

CREATE TABLE "venture_ledger_journals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" integer NOT NULL,
  "approval_id" uuid,
  "idempotency_key" text NOT NULL,
  "description" text NOT NULL,
  "actor_type" text NOT NULL,
  "actor_key" text NOT NULL,
  "sealed" boolean DEFAULT false NOT NULL,
  "sealed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_ledger_journals_actor_type_check" CHECK ("actor_type" IN ('human','service','system')),
  CONSTRAINT "venture_ledger_journals_seal_check" CHECK (("sealed" = false AND "sealed_at" IS NULL) OR ("sealed" = true AND "sealed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "venture_ledger_journals" ADD CONSTRAINT "venture_ledger_journals_experiment_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_ledger_journals" ADD CONSTRAINT "venture_ledger_journals_approval_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."venture_approval_requests"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_ledger_journals_idempotency_idx" ON "venture_ledger_journals" ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_ledger_journals_approval_idx" ON "venture_ledger_journals" ("approval_id") WHERE "approval_id" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE "venture_ledger_postings" (
  "id" serial PRIMARY KEY NOT NULL,
  "journal_id" uuid NOT NULL,
  "account_id" integer NOT NULL,
  "debit_minor" integer DEFAULT 0 NOT NULL,
  "credit_minor" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_ledger_postings_amount_check" CHECK (
    ("debit_minor" > 0 AND "credit_minor" = 0)
    OR ("credit_minor" > 0 AND "debit_minor" = 0)
  )
);
--> statement-breakpoint
ALTER TABLE "venture_ledger_postings" ADD CONSTRAINT "venture_ledger_postings_journal_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."venture_ledger_journals"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_ledger_postings" ADD CONSTRAINT "venture_ledger_postings_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."venture_ledger_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_ledger_postings_journal_idx" ON "venture_ledger_postings" ("journal_id");
--> statement-breakpoint

CREATE TABLE "venture_audit_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "experiment_id" integer,
  "actor_type" text NOT NULL,
  "actor_key" text NOT NULL,
  "action" text NOT NULL,
  "reason" text,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "approval_id" uuid,
  "journal_id" uuid,
  "request_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_audit_events_actor_type_check" CHECK ("actor_type" IN ('human','service','system'))
);
--> statement-breakpoint
ALTER TABLE "venture_audit_events" ADD CONSTRAINT "venture_audit_events_experiment_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_audit_events" ADD CONSTRAINT "venture_audit_events_approval_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."venture_approval_requests"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_audit_events" ADD CONSTRAINT "venture_audit_events_journal_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."venture_ledger_journals"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_audit_events_experiment_created_idx" ON "venture_audit_events" ("experiment_id","created_at");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_reject_history_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Venture Lab history is append-only';
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_service_account"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab service accounts cannot be deleted';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Venture Lab service account identity is immutable';
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
CREATE TRIGGER "venture_service_accounts_guard" BEFORE UPDATE OR DELETE ON "venture_service_accounts" FOR EACH ROW EXECUTE FUNCTION "venture_guard_service_account"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_budget_envelope"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab budget envelopes cannot be deleted';
  END IF;
  IF OLD.experiment_id IS DISTINCT FROM NEW.experiment_id OR OLD.kind IS DISTINCT FROM NEW.kind OR OLD.currency IS DISTINCT FROM NEW.currency OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Venture Lab budget-envelope identity is immutable';
  END IF;
  IF OLD.kind = 'protected_reserve' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Protected Venture Lab reserve cannot be mutated';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_budget_envelopes_guard" BEFORE UPDATE OR DELETE ON "venture_budget_envelopes" FOR EACH ROW EXECUTE FUNCTION "venture_guard_budget_envelope"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_approval_request"() RETURNS trigger
LANGUAGE plpgsql AS $$
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
CREATE TRIGGER "venture_approval_requests_guard" BEFORE UPDATE OR DELETE ON "venture_approval_requests" FOR EACH ROW EXECUTE FUNCTION "venture_guard_approval_request"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_ledger_journal"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  posting_count integer;
  debit_total bigint;
  credit_total bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab ledger journals are append-only';
  END IF;
  IF OLD.sealed = true THEN
    RAISE EXCEPTION 'Sealed Venture Lab ledger journals are immutable';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.experiment_id IS DISTINCT FROM NEW.experiment_id
    OR OLD.approval_id IS DISTINCT FROM NEW.approval_id
    OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.actor_type IS DISTINCT FROM NEW.actor_type
    OR OLD.actor_key IS DISTINCT FROM NEW.actor_key
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
    OR NEW.sealed IS DISTINCT FROM true
    OR NEW.sealed_at IS NULL
  THEN
    RAISE EXCEPTION 'Venture Lab ledger journal may only transition once from open to sealed';
  END IF;

  SELECT count(*), coalesce(sum(debit_minor),0), coalesce(sum(credit_minor),0)
    INTO posting_count, debit_total, credit_total
    FROM venture_ledger_postings
    WHERE journal_id = OLD.id;

  IF posting_count < 2 OR debit_total <= 0 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'Venture Lab ledger journal must balance before sealing';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_ledger_journals_guard" BEFORE UPDATE OR DELETE ON "venture_ledger_journals" FOR EACH ROW EXECUTE FUNCTION "venture_guard_ledger_journal"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_ledger_posting_insert"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  journal_sealed boolean;
BEGIN
  SELECT sealed INTO journal_sealed FROM venture_ledger_journals WHERE id = NEW.journal_id FOR UPDATE;
  IF journal_sealed IS NULL THEN
    RAISE EXCEPTION 'Venture Lab ledger journal does not exist';
  END IF;
  IF journal_sealed = true THEN
    RAISE EXCEPTION 'Cannot add postings to a sealed Venture Lab ledger journal';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_ledger_postings_insert_guard" BEFORE INSERT ON "venture_ledger_postings" FOR EACH ROW EXECUTE FUNCTION "venture_guard_ledger_posting_insert"();
--> statement-breakpoint
CREATE TRIGGER "venture_ledger_postings_append_only" BEFORE UPDATE OR DELETE ON "venture_ledger_postings" FOR EACH ROW EXECUTE FUNCTION "venture_reject_history_mutation"();
--> statement-breakpoint
CREATE TRIGGER "venture_approval_events_append_only" BEFORE UPDATE OR DELETE ON "venture_approval_events" FOR EACH ROW EXECUTE FUNCTION "venture_reject_history_mutation"();
--> statement-breakpoint
CREATE TRIGGER "venture_audit_events_append_only" BEFORE UPDATE OR DELETE ON "venture_audit_events" FOR EACH ROW EXECUTE FUNCTION "venture_reject_history_mutation"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_require_sealed_journal_at_commit"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_sealed boolean;
BEGIN
  SELECT sealed INTO current_sealed FROM venture_ledger_journals WHERE id = NEW.id;
  IF current_sealed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Venture Lab ledger journal must be sealed before commit';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "venture_ledger_journals_require_sealed"
AFTER INSERT ON "venture_ledger_journals"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "venture_require_sealed_journal_at_commit"();
