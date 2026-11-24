-- Operation ASCEND B2.8: durable, founder-governed internal execution engine.
-- Additive only. Nothing here sends messages, moves money, changes commission, publishes agreements,
-- activates partners, deletes applicant records or changes founder permissions. Those action families are
-- refused by CHECK constraints below, independently of application code.

-- Layered emergency controls. The global row starts SUSPENDED: resuming is a deliberate, audited founder act.
CREATE TABLE ascend_automation_controls (
  scope text PRIMARY KEY CHECK (scope = 'global' OR scope ~ '^action:[a-z][a-z0-9_.]{2,63}$'),
  suspended boolean NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  changed_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1)
);
INSERT INTO ascend_automation_controls (scope, suspended, reason)
  VALUES ('global', true, 'Initial state: automation is suspended until founders deliberately resume it.');

-- Registered automation definitions. The action registry in code is the only source of handlers;
-- a row here can tune and gate an action, never define new behaviour.
CREATE TABLE ascend_automation_definitions (
  action_type text PRIMARY KEY CHECK (action_type ~ '^[a-z][a-z0-9_.]{2,63}$'
    -- Prohibited action families (payouts, commission, ledgers, external communication, agreements, activation,
    -- permissions, destructive retention). Enforced here so no registry change can introduce them silently.
    AND action_type !~ '(payout|withdraw|commission|ledger|payment|refund|invoice|clawback|agreement|publish|activat|permission|role|grant|retention|purge|delete|erase|email|mail|send|notify|dispatch|sms|social|contact)'),
  enabled boolean NOT NULL DEFAULT false,
  interval_seconds integer CHECK (interval_seconds IS NULL OR interval_seconds BETWEEN 300 AND 2592000),
  cooldown_seconds integer NOT NULL DEFAULT 3600 CHECK (cooldown_seconds BETWEEN 0 AND 2592000),
  max_concurrency integer NOT NULL DEFAULT 1 CHECK (max_concurrency BETWEEN 1 AND 8),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  timeout_seconds integer NOT NULL DEFAULT 30 CHECK (timeout_seconds BETWEEN 1 AND 50),
  requires_approval boolean NOT NULL DEFAULT true,
  approval_ttl_seconds integer NOT NULL DEFAULT 86400 CHECK (approval_ttl_seconds BETWEEN 300 AND 604800),
  policy_version integer NOT NULL DEFAULT 1 CHECK (policy_version >= 1),
  market_scope text[] NOT NULL DEFAULT ARRAY['GB']::text[] CHECK (cardinality(market_scope) BETWEEN 1 AND 50),
  expires_at timestamptz,
  updated_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The registered actions start present but DISABLED, requiring founder approval, UK-only. Enabling is a founder act.
INSERT INTO ascend_automation_definitions (action_type) VALUES
  ('ops.queue_health'), ('pipeline.inactivity_scan'), ('onboarding.progress_check'), ('delivery.handoff_readiness'), ('review.queue_preparation');

-- Scoped machine identities (the ASCEND worker, and future TITAN OS / Jarvis agents). Tokens are stored only as
-- SHA-256 digests. No capability can approve, administer identities or change controls: those stay human.
CREATE TABLE ascend_service_identities (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (name ~ '^[a-z][a-z0-9-]{2,62}$'),
  kind text NOT NULL CHECK (kind IN ('worker','agent')),
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  capabilities text[] NOT NULL CHECK (cardinality(capabilities) BETWEEN 1 AND 4),
  allowed_actions text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK (cardinality(allowed_actions) <= 50),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  CHECK ((kind = 'worker' AND capabilities <@ ARRAY['worker.execute']::text[])
      OR (kind = 'agent' AND capabilities <@ ARRAY['operations.submit','operations.read','operations.cancel']::text[])),
  CHECK (active OR revoked_at IS NOT NULL)
);

CREATE TABLE ascend_workers (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$'),
  service_identity_id uuid NOT NULL REFERENCES ascend_service_identities(id) ON DELETE RESTRICT,
  version text NOT NULL CHECK (length(version) BETWEEN 1 AND 80),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','draining','stopped')),
  max_concurrency integer NOT NULL CHECK (max_concurrency BETWEEN 1 AND 8),
  in_flight integer NOT NULL DEFAULT 0 CHECK (in_flight BETWEEN 0 AND 8),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ascend_executions (
  id uuid PRIMARY KEY,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  action_type text NOT NULL REFERENCES ascend_automation_definitions(action_type) ON DELETE RESTRICT,
  payload_version integer NOT NULL CHECK (payload_version >= 1),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 16384),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  scope jsonb NOT NULL CHECK (jsonb_typeof(scope) = 'object' AND octet_length(scope::text) <= 4096),
  policy_version integer NOT NULL CHECK (policy_version >= 1),
  policy_decision jsonb NOT NULL CHECK (jsonb_typeof(policy_decision) = 'object'),
  origin text NOT NULL CHECK (origin IN ('founder','schedule','signal','agent')),
  origin_ref text CHECK (origin_ref IS NULL OR length(origin_ref) <= 200),
  requested_by_admin uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  requested_by_service uuid REFERENCES ascend_service_identities(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('created','pending_approval','approved','scheduled','queued','leased','running',
    'retry_scheduled','completed','failed','dead_lettered','cancelled','expired','superseded','ambiguous')),
  approval_required boolean NOT NULL,
  approved_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  approval_expires_at timestamptz,
  approval_digest text CHECK (approval_digest IS NULL OR approval_digest ~ '^[0-9a-f]{64}$'),
  deadline_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),
  lease_token uuid,
  lease_owner text,
  lease_expires_at timestamptz,
  cancel_requested boolean NOT NULL DEFAULT false,
  failure_class text CHECK (failure_class IS NULL OR failure_class IN ('transient','database_unavailable','rate_limited',
    'invalid_payload','authentication','permission','approval_expired','policy_rejection','provider_failure',
    'duplicate','ambiguous','business_rule','deadline_exceeded','cancelled')),
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 500),
  result jsonb CHECK (result IS NULL OR (jsonb_typeof(result) = 'object' AND octet_length(result::text) <= 65536)),
  superseded_by uuid REFERENCES ascend_executions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (attempts <= max_attempts),
  CHECK ((status IN ('leased','running')) = (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND lease_owner IS NOT NULL)),
  CHECK ((origin = 'founder') = (requested_by_admin IS NOT NULL)),
  CHECK ((origin = 'agent') = (requested_by_service IS NOT NULL)),
  CHECK (NOT approval_required OR status NOT IN ('approved','scheduled','queued','leased','running','completed')
         OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND approval_expires_at IS NOT NULL AND approval_digest IS NOT NULL)),
  CHECK ((status IN ('completed','failed','dead_lettered','cancelled','expired','superseded')) = (completed_at IS NOT NULL))
);
CREATE INDEX ascend_executions_due_idx ON ascend_executions (available_at, id) WHERE status IN ('queued','retry_scheduled');
CREATE INDEX ascend_executions_leases_idx ON ascend_executions (lease_expires_at) WHERE status IN ('leased','running');
CREATE INDEX ascend_executions_status_idx ON ascend_executions (status, updated_at DESC);
CREATE INDEX ascend_executions_action_idx ON ascend_executions (action_type, created_at DESC);
CREATE INDEX ascend_executions_correlation_idx ON ascend_executions (correlation_id);
CREATE INDEX ascend_executions_cooldown_idx ON ascend_executions (action_type, payload_sha256, created_at DESC);
-- Benchmark-driven (B2.8 report): keyset pagination for the explorer, and bounded 24-hour windows for the overview.
CREATE INDEX ascend_executions_keyset_idx ON ascend_executions (created_at DESC, id DESC);
CREATE INDEX ascend_executions_completed_idx ON ascend_executions (completed_at) WHERE completed_at IS NOT NULL;

-- Identity, payload and approval binding are immutable once written; the lifecycle is a validated state machine.
CREATE FUNCTION ascend_execution_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed text[];
BEGIN
  IF NEW.id <> OLD.id OR NEW.correlation_id <> OLD.correlation_id OR NEW.idempotency_key <> OLD.idempotency_key
     OR NEW.action_type <> OLD.action_type OR NEW.payload_version <> OLD.payload_version OR NEW.payload <> OLD.payload
     OR NEW.payload_sha256 <> OLD.payload_sha256 OR NEW.scope <> OLD.scope OR NEW.origin <> OLD.origin
     OR NEW.requested_by_admin IS DISTINCT FROM OLD.requested_by_admin
     OR NEW.requested_by_service IS DISTINCT FROM OLD.requested_by_service OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'ascend execution identity and payload are immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  allowed := CASE OLD.status
    WHEN 'created' THEN ARRAY['pending_approval','queued','scheduled','cancelled','expired','superseded']
    WHEN 'pending_approval' THEN ARRAY['approved','cancelled','expired','superseded']
    WHEN 'approved' THEN ARRAY['queued','scheduled','cancelled','expired','superseded']
    WHEN 'scheduled' THEN ARRAY['queued','cancelled','expired','superseded']
    WHEN 'queued' THEN ARRAY['leased','cancelled','expired','superseded']
    WHEN 'retry_scheduled' THEN ARRAY['leased','queued','cancelled','expired','dead_lettered','superseded']
    WHEN 'leased' THEN ARRAY['running','queued','retry_scheduled','failed','dead_lettered','cancelled','expired']
    WHEN 'running' THEN ARRAY['completed','retry_scheduled','queued','failed','dead_lettered','ambiguous','cancelled','expired']
    WHEN 'ambiguous' THEN ARRAY['completed','failed']
    -- A founder retry re-enters policy evaluation; it never skips approval.
    WHEN 'failed' THEN ARRAY['pending_approval','queued']
    WHEN 'dead_lettered' THEN ARRAY['pending_approval','queued']
    ELSE ARRAY[]::text[]
  END;
  IF NOT (NEW.status = ANY(allowed)) THEN
    RAISE EXCEPTION 'invalid ascend execution transition % -> %', OLD.status, NEW.status USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ascend_executions_guard BEFORE UPDATE ON ascend_executions
  FOR EACH ROW EXECUTE FUNCTION ascend_execution_guard();

CREATE TABLE ascend_execution_events (
  id bigserial PRIMARY KEY,
  execution_id uuid NOT NULL REFERENCES ascend_executions(id) ON DELETE RESTRICT,
  event text NOT NULL CHECK (event ~ '^[a-z_]{3,40}$'),
  from_status text,
  to_status text,
  actor_kind text NOT NULL CHECK (actor_kind IN ('founder','service','system')),
  actor_ref text CHECK (actor_ref IS NULL OR length(actor_ref) <= 120),
  detail jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(detail) = 'object' AND octet_length(detail::text) <= 4096),
  -- Statement time, not transaction start: an event waiting on a lock records when it actually happened.
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ascend_execution_events_execution_idx ON ascend_execution_events (execution_id, id);
CREATE INDEX ascend_execution_events_started_idx ON ascend_execution_events (occurred_at) WHERE event = 'started';
CREATE TRIGGER ascend_execution_events_immutable BEFORE UPDATE OR DELETE ON ascend_execution_events
  FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

-- Control-plane audit: suspensions, resumptions, definition and identity changes.
CREATE TABLE ascend_control_events (
  id bigserial PRIMARY KEY,
  event text NOT NULL CHECK (event ~ '^[a-z_]{3,40}$'),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 120),
  actor_id uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  detail jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(detail) = 'object' AND octet_length(detail::text) <= 4096),
  -- Statement time, not transaction start: an event waiting on a lock records when it actually happened.
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ascend_control_events_time_idx ON ascend_control_events (occurred_at DESC);
CREATE TRIGGER ascend_control_events_immutable BEFORE UPDATE OR DELETE ON ascend_control_events
  FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
