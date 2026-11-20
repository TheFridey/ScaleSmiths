-- Operation Intelligence checkpoint 5 (forward-only): founder-controlled Founding Partner recognition.
-- Recognition is a founder judgement on recorded evidence. It is never granted by application order, activation date or any numeric threshold,
-- and it carries no equity, ownership, directorship, employment or guaranteed income. Benefits are manual records; nothing here pays anyone.
CREATE TABLE expansion_recognitions (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 kind text NOT NULL DEFAULT 'founding_partner' CHECK (kind IN ('founding_partner')),
 status text NOT NULL DEFAULT 'nominated' CHECK (status IN ('nominated','under_review','approved','rejected','revoked')),
 rationale text NOT NULL CHECK (char_length(rationale) BETWEEN 10 AND 3000),
 nominated_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, nominated_at timestamptz NOT NULL DEFAULT now(),
 decided_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, decided_at timestamptz, decision_note text,
 recognition_date date, badge_version text,
 revoked_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, revoked_at timestamptz, revoke_reason text,
 CHECK (status NOT IN ('approved','rejected','revoked') OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_note IS NOT NULL)),
 CHECK ((status IN ('approved','revoked')) = (recognition_date IS NOT NULL AND badge_version IS NOT NULL)),
 CHECK ((status = 'revoked') = (revoked_by IS NOT NULL AND revoked_at IS NOT NULL AND revoke_reason IS NOT NULL))
);
-- One live recognition per partner and kind. A rejected or revoked one can be followed by a fresh, separately evidenced nomination.
CREATE UNIQUE INDEX expansion_recognitions_live ON expansion_recognitions(partner_id, kind) WHERE status IN ('nominated','under_review','approved');
CREATE TABLE expansion_recognition_evidence (
 id uuid PRIMARY KEY, recognition_id uuid NOT NULL REFERENCES expansion_recognitions(id) ON DELETE RESTRICT,
 description text NOT NULL CHECK (char_length(description) BETWEEN 5 AND 2000), reference text,
 added_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_recognition_evidence_immutable BEFORE UPDATE OR DELETE ON expansion_recognition_evidence FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE TABLE expansion_recognition_benefits (
 id uuid PRIMARY KEY, recognition_id uuid NOT NULL REFERENCES expansion_recognitions(id) ON DELETE RESTRICT,
 benefit text NOT NULL CHECK (char_length(benefit) BETWEEN 5 AND 500),
 approved_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_recognition_benefits_immutable BEFORE UPDATE OR DELETE ON expansion_recognition_benefits FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE TABLE expansion_recognition_fulfilments (
 id uuid PRIMARY KEY, benefit_id uuid NOT NULL REFERENCES expansion_recognition_benefits(id) ON DELETE RESTRICT,
 outcome text NOT NULL CHECK (outcome IN ('fulfilled','withdrawn')), note text NOT NULL CHECK (char_length(note) BETWEEN 3 AND 1000),
 recorded_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_recognition_fulfilments_immutable BEFORE UPDATE OR DELETE ON expansion_recognition_fulfilments FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE TABLE expansion_recognition_corrections (
 id uuid PRIMARY KEY, recognition_id uuid NOT NULL REFERENCES expansion_recognitions(id) ON DELETE RESTRICT,
 before_value jsonb NOT NULL, after_value jsonb NOT NULL, reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
 corrected_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_recognition_corrections_immutable BEFORE UPDATE OR DELETE ON expansion_recognition_corrections FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE FUNCTION expansion_recognition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Recognition history is append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.kind <> OLD.kind OR NEW.nominated_by <> OLD.nominated_by OR NEW.nominated_at <> OLD.nominated_at THEN RAISE EXCEPTION 'Recognition identity is immutable'; END IF;
  IF OLD.status IN ('rejected','revoked') THEN RAISE EXCEPTION 'A closed recognition cannot change; nominate again with new evidence'; END IF;
  IF NEW.status = OLD.status THEN
    -- Only a recorded, audited correction (set by the service after it writes the before/after row) may change an approved recognition.
    IF OLD.status = 'approved' AND (NEW.rationale <> OLD.rationale OR NEW.recognition_date <> OLD.recognition_date) AND COALESCE(current_setting('app.recognition_correction', true), '') <> 'verified' THEN
      RAISE EXCEPTION 'An approved recognition changes only through a recorded correction';
    END IF;
    IF OLD.status <> 'approved' AND (NEW.rationale <> OLD.rationale) THEN RAISE EXCEPTION 'The nomination rationale cannot be edited; withdraw and nominate again'; END IF;
    RETURN NEW;
  END IF;
  IF NOT ((OLD.status = 'nominated' AND NEW.status = 'under_review') OR (OLD.status = 'under_review' AND NEW.status IN ('approved','rejected')) OR (OLD.status = 'approved' AND NEW.status = 'revoked')) THEN
    RAISE EXCEPTION 'Invalid recognition transition from % to %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'approved' AND NOT EXISTS (SELECT 1 FROM expansion_recognition_evidence e WHERE e.recognition_id = NEW.id) THEN RAISE EXCEPTION 'Recognition cannot be approved without recorded supporting evidence'; END IF;
  IF NEW.status = 'approved' AND NEW.recognition_date > (now() AT TIME ZONE 'Europe/London')::date THEN RAISE EXCEPTION 'The recognition date cannot be in the future'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_recognition_guard BEFORE UPDATE OR DELETE ON expansion_recognitions FOR EACH ROW EXECUTE FUNCTION expansion_recognition_guard();
CREATE FUNCTION expansion_recognition_benefit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM expansion_recognitions r WHERE r.id = NEW.recognition_id AND r.status = 'approved') THEN RAISE EXCEPTION 'Benefits can be approved only for an approved recognition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_recognition_benefit_guard BEFORE INSERT ON expansion_recognition_benefits FOR EACH ROW EXECUTE FUNCTION expansion_recognition_benefit_guard();
