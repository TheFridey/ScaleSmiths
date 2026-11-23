-- Operation ASCEND B2.7: internal, founder-reviewed durable recommendation queue.
-- No external transport, funds, commercial changes or autonomous client contact.
CREATE TABLE ascend_review_jobs (
  id uuid PRIMARY KEY,
  signal_key text NOT NULL UNIQUE CHECK(length(signal_key) BETWEEN 1 AND 200),
  source text NOT NULL CHECK(source IN ('sales_command','delivery_handoff')),
  kind text NOT NULL CHECK(length(kind) BETWEEN 1 AND 80),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','leased','ready','dead','resolved')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='leased') = (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE INDEX ascend_review_jobs_due_idx ON ascend_review_jobs(available_at,id) WHERE status IN ('pending','leased');
CREATE INDEX ascend_review_jobs_status_idx ON ascend_review_jobs(status,updated_at DESC);
CREATE TABLE ascend_review_job_events (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES ascend_review_jobs(id) ON DELETE RESTRICT,
  event text NOT NULL CHECK(event IN ('observed','claimed','ready','retry','dead','resolved')),
  detail jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(detail)='object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ascend_review_job_events_job_idx ON ascend_review_job_events(job_id,occurred_at);
CREATE TRIGGER ascend_review_job_events_immutable BEFORE UPDATE OR DELETE ON ascend_review_job_events
  FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
