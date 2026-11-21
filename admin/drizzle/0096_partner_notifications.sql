-- Operation Launch Ready: an auditable record of every partner lifecycle email attempt.
-- One row per message, keyed by an idempotency key so a retried request never sends twice. The recipient is stored only as a
-- SHA-256 of the normalised address (no plaintext email here). Failed messages can be retried by a founder; invitation emails
-- cannot (the secret link is never stored), so a founder issues a new invitation instead.
CREATE TABLE partner_notifications (
 id uuid PRIMARY KEY,
 idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
 kind text NOT NULL CHECK (kind IN ('application_received','information_requested','application_declined','invitation','activated','agreement_reissued')),
 application_id integer REFERENCES partner_applications(id) ON DELETE SET NULL,
 partner_id uuid REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 recipient_sha256 text NOT NULL CHECK (recipient_sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL CHECK (status IN ('sent','failed','not_configured','disabled')),
 failure_reason text CHECK (failure_reason IS NULL OR char_length(failure_reason) <= 200),
 attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 10),
 actor_id uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_notifications_application_idx ON partner_notifications (application_id, created_at DESC);
CREATE INDEX partner_notifications_partner_idx ON partner_notifications (partner_id, created_at DESC);

-- Outcomes may move forward (a retry can turn 'failed' into 'sent'), but a message never changes what it was or who it was for,
-- and the log is never deleted except through the applicant retention purge clearing application_id.
CREATE FUNCTION partner_notification_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Partner notification history is retained' USING ERRCODE = 'check_violation';
  END IF;
  IF (NEW.id, NEW.idempotency_key, NEW.kind, NEW.partner_id, NEW.recipient_sha256, NEW.actor_id, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.idempotency_key, OLD.kind, OLD.partner_id, OLD.recipient_sha256, OLD.actor_id, OLD.created_at)
     OR (NEW.application_id IS DISTINCT FROM OLD.application_id AND NEW.application_id IS NOT NULL) THEN
    RAISE EXCEPTION 'A partner notification record cannot be rewritten' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'sent' AND NEW.status <> 'sent' THEN
    RAISE EXCEPTION 'A sent notification cannot be marked unsent' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.attempts < OLD.attempts THEN
    RAISE EXCEPTION 'Notification attempts only increase' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER partner_notification_guard BEFORE UPDATE OR DELETE ON partner_notifications FOR EACH ROW EXECUTE FUNCTION partner_notification_guard();
