-- Operation Intelligence checkpoint 5 (forward-only): residual review findings A, B and D.
-- A. Qualification review flags are raised by triggers on refunds and cancellations, so no application path can miss them.
CREATE TABLE expansion_qualification_flags (
 id uuid PRIMARY KEY, qualification_id uuid NOT NULL REFERENCES expansion_client_qualifications(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK (reason IN ('refund','cancellation')), source_reference text,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
 resolution text CHECK (resolution IN ('maintained','revoked')), resolution_note text,
 resolved_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, resolved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status = 'resolved') = (resolution IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND resolution_note IS NOT NULL))
);
-- One open flag per qualification and reason; a later event after resolution raises a fresh flag.
CREATE UNIQUE INDEX expansion_qualification_flag_open ON expansion_qualification_flags(qualification_id, reason) WHERE status = 'open';
CREATE FUNCTION expansion_qualification_flag_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Qualification review history is append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.qualification_id <> OLD.qualification_id OR NEW.reason <> OLD.reason OR NEW.created_at <> OLD.created_at OR NEW.source_reference IS DISTINCT FROM OLD.source_reference THEN
    RAISE EXCEPTION 'A review flag is immutable; resolve it';
  END IF;
  IF OLD.status = 'resolved' THEN RAISE EXCEPTION 'A resolved review flag cannot change'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_qualification_flag_guard BEFORE UPDATE OR DELETE ON expansion_qualification_flags FOR EACH ROW EXECUTE FUNCTION expansion_qualification_flag_guard();
CREATE FUNCTION expansion_flag_qualifications(p_contract uuid, p_reason text, p_source text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO expansion_qualification_flags(id, qualification_id, reason, source_reference)
  SELECT gen_random_uuid(), q.id, p_reason, p_source FROM expansion_client_qualifications q WHERE q.contract_id = p_contract AND q.status = 'qualified'
  ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION expansion_refund_flags_qualification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.net_pence < 0 THEN PERFORM expansion_flag_qualifications(NEW.contract_id, 'refund', NEW.id::text); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_refund_flags_qualification AFTER INSERT ON expansion_payment_events FOR EACH ROW EXECUTE FUNCTION expansion_refund_flags_qualification();
CREATE FUNCTION expansion_cancellation_flags_qualification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM expansion_flag_qualifications(NEW.contract_id, 'cancellation', NEW.contract_id::text);
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_cancellation_flags_qualification AFTER INSERT ON expansion_contract_cancellations FOR EACH ROW EXECUTE FUNCTION expansion_cancellation_flags_qualification();

-- B. Reward lifecycle: nothing moves forward while entitlement is disputed or no longer met; an explicit, evidenced
-- 'withdrawn' resolution exists for approved/pending rewards (fulfilled rewards are settled history and cannot be withdrawn).
ALTER TABLE expansion_achievement_rewards DROP CONSTRAINT expansion_achievement_rewards_status_check;
ALTER TABLE expansion_achievement_rewards ADD CONSTRAINT expansion_achievement_rewards_status_check
  CHECK (status IN ('conditional','under_review','approved','fulfilment_pending','fulfilled','rejected','withdrawn'));
CREATE FUNCTION expansion_partner_entitlement_ok(p_partner uuid, p_needed integer) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (SELECT count(*) FROM expansion_client_qualifications q WHERE q.partner_id = p_partner AND q.status = 'qualified') >= p_needed
     AND NOT EXISTS (SELECT 1 FROM expansion_qualification_flags f JOIN expansion_client_qualifications q ON q.id = f.qualification_id WHERE q.partner_id = p_partner AND f.status = 'open')
$$;
CREATE OR REPLACE FUNCTION expansion_reward_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Rewards are append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.milestone_clients <> OLD.milestone_clients
     OR NEW.kind <> OLD.kind OR NEW.reward_pence <> OLD.reward_pence THEN RAISE EXCEPTION 'Reward terms are immutable'; END IF;
  IF NEW.programme_version IS DISTINCT FROM OLD.programme_version THEN
    IF OLD.programme_version IS NOT NULL OR NOT EXISTS (SELECT 1 FROM expansion_achievement_milestones m JOIN expansion_achievement_programmes p ON p.version = m.programme_version
        WHERE m.programme_version = NEW.programme_version AND p.approved AND m.clients = NEW.milestone_clients AND m.kind = NEW.kind AND m.reward_pence = NEW.reward_pence) THEN
      RAISE EXCEPTION 'A reward can only adopt an approved programme that defines the same milestone and amount';
    END IF;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT ((OLD.status = 'conditional' AND NEW.status IN ('under_review','rejected'))
       OR (OLD.status = 'under_review' AND NEW.status IN ('approved','rejected'))
       OR (OLD.status = 'approved' AND NEW.status IN ('fulfilment_pending','fulfilled','withdrawn'))
       OR (OLD.status = 'fulfilment_pending' AND NEW.status IN ('fulfilled','withdrawn'))) THEN
    RAISE EXCEPTION 'Invalid reward transition from % to %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'withdrawn' THEN
    IF NEW.reviewed_by IS NULL OR NEW.review_note IS NULL OR NEW.review_note IS NOT DISTINCT FROM OLD.review_note THEN RAISE EXCEPTION 'Withdrawing an approved reward needs a founder and a recorded reason'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.status <> 'rejected' AND NOT expansion_partner_entitlement_ok(NEW.partner_id, NEW.milestone_clients) THEN
    RAISE EXCEPTION 'The qualification behind this reward is disputed, revoked or awaiting review; resolve it before the reward can progress';
  END IF;
  IF NEW.status IN ('approved','fulfilment_pending','fulfilled') THEN
    IF NEW.programme_version IS NULL OR NOT EXISTS (SELECT 1 FROM expansion_achievement_programmes p WHERE p.version = NEW.programme_version AND p.approved) THEN
      RAISE EXCEPTION 'A reward can only be approved under an approved programme version';
    END IF;
    IF NEW.kind = 'bonus' AND NOT EXISTS (SELECT 1 FROM expansion_achievement_programmes p WHERE p.version = NEW.programme_version AND p.financial_rewards_enabled) THEN
      RAISE EXCEPTION 'Financial rewards are not enabled for this programme version';
    END IF;
    IF NEW.reviewed_by IS NULL THEN RAISE EXCEPTION 'A founder decision is required'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION expansion_referral_reward_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE referred uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Referral rewards are append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.referral_id <> OLD.referral_id OR NEW.amount_pence <> OLD.amount_pence THEN RAISE EXCEPTION 'Referral reward terms are immutable'; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT ((OLD.status = 'conditional' AND NEW.status IN ('under_review','rejected'))
       OR (OLD.status = 'under_review' AND NEW.status IN ('approved','rejected'))
       OR (OLD.status = 'approved' AND NEW.status = 'fulfilled')) THEN RAISE EXCEPTION 'Invalid referral reward transition from % to %', OLD.status, NEW.status; END IF;
  IF NEW.status IN ('approved','fulfilled') THEN
    SELECT p.id INTO referred FROM expansion_referrals r JOIN expansion_partners p ON p.application_id = r.application_id AND p.activated_at IS NOT NULL WHERE r.id = NEW.referral_id;
    IF referred IS NULL OR NOT expansion_partner_entitlement_ok(referred, 5) THEN
      RAISE EXCEPTION 'The referred partner is not activated with five undisputed qualifying clients; resolve the qualification review first';
    END IF;
    IF NEW.programme_version IS NULL OR NOT EXISTS (SELECT 1 FROM expansion_achievement_programmes p WHERE p.version = NEW.programme_version AND p.approved AND p.referral_rewards_enabled) THEN
      RAISE EXCEPTION 'Referral rewards are not enabled under an approved programme version';
    END IF;
    IF NEW.reviewed_by IS NULL THEN RAISE EXCEPTION 'A founder decision is required'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- D. Meeting history: purpose, time zone and slots never change once submitted; a closed request cannot change at all.
-- Corrections are explicit, founder-made and recorded.
CREATE TABLE expansion_meeting_corrections (
 id uuid PRIMARY KEY, meeting_id uuid NOT NULL REFERENCES expansion_meeting_requests(id) ON DELETE RESTRICT,
 before_value jsonb NOT NULL, after_value jsonb NOT NULL, reason text NOT NULL,
 corrected_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION expansion_meeting_correction_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Meeting corrections are append-only'; END $$;
CREATE TRIGGER expansion_meeting_correction_guard BEFORE UPDATE OR DELETE ON expansion_meeting_corrections FOR EACH ROW EXECUTE FUNCTION expansion_meeting_correction_guard();
CREATE OR REPLACE FUNCTION expansion_meeting_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE correcting boolean := coalesce(current_setting('app.meeting_correction', true), '') = 'verified';
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Meeting requests are append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.meeting_type <> OLD.meeting_type OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'A meeting request''s subject is immutable';
  END IF;
  IF (NEW.purpose <> OLD.purpose OR NEW.preferred_slots <> OLD.preferred_slots OR NEW.time_zone <> OLD.time_zone) AND NOT correcting THEN
    RAISE EXCEPTION 'The submitted purpose, time zone and preferred times cannot be edited; a founder can record a correction';
  END IF;
  IF OLD.status IN ('declined','cancelled','completed') AND NOT correcting THEN RAISE EXCEPTION 'A closed meeting request cannot change'; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT ((OLD.status = 'requested' AND NEW.status IN ('under_review','info_required','alternative_proposed','confirmed','declined','cancelled'))
       OR (OLD.status = 'under_review' AND NEW.status IN ('info_required','alternative_proposed','confirmed','declined','cancelled'))
       OR (OLD.status = 'info_required' AND NEW.status IN ('requested','declined','cancelled'))
       OR (OLD.status = 'alternative_proposed' AND NEW.status IN ('confirmed','requested','declined','cancelled'))
       OR (OLD.status = 'confirmed' AND NEW.status IN ('completed','cancelled'))) THEN
    RAISE EXCEPTION 'Invalid meeting transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;
