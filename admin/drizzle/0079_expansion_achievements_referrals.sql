-- Operation Intelligence checkpoint 4B: achievements and referrals (forward-only). Nothing here creates a payable liability:
-- there is no ledger or payout integration for rewards, and financial/referral rewards cannot be approved unless a programme
-- version with an approval reference explicitly enables them (database-enforced, default off).
CREATE TABLE expansion_achievement_programmes (
 version serial PRIMARY KEY, label text NOT NULL,
 approved boolean NOT NULL DEFAULT false,
 financial_rewards_enabled boolean NOT NULL DEFAULT false,
 referral_rewards_enabled boolean NOT NULL DEFAULT false,
 min_qualifying_collected_pence integer CHECK (min_qualifying_collected_pence IS NULL OR min_qualifying_collected_pence > 0),
 approval_reference text, approved_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (NOT approved OR (approval_reference IS NOT NULL AND approved_by IS NOT NULL)),
 CHECK (NOT (financial_rewards_enabled OR referral_rewards_enabled) OR approved)
);
CREATE FUNCTION expansion_programme_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Programme versions are append-only'; END IF;
  IF OLD.approved THEN RAISE EXCEPTION 'An approved programme version is immutable; create a new version'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_programme_guard BEFORE UPDATE OR DELETE ON expansion_achievement_programmes FOR EACH ROW EXECUTE FUNCTION expansion_programme_guard();
CREATE TABLE expansion_achievement_milestones (
 programme_version integer NOT NULL REFERENCES expansion_achievement_programmes(version) ON DELETE RESTRICT,
 clients integer NOT NULL CHECK (clients > 0), kind text NOT NULL CHECK (kind IN ('polo','webpage','bonus')),
 reward_pence integer NOT NULL DEFAULT 0 CHECK (reward_pence >= 0), label text NOT NULL,
 PRIMARY KEY (programme_version, clients), CHECK ((kind = 'bonus') = (reward_pence > 0))
);
CREATE FUNCTION expansion_milestone_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v integer := COALESCE(NEW.programme_version, OLD.programme_version);
BEGIN
  IF EXISTS (SELECT 1 FROM expansion_achievement_programmes WHERE version = v AND approved) THEN RAISE EXCEPTION 'Milestones of an approved programme are immutable'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER expansion_milestone_guard BEFORE INSERT OR UPDATE OR DELETE ON expansion_achievement_milestones FOR EACH ROW EXECUTE FUNCTION expansion_milestone_guard();

-- A qualifying client is a founder decision on a real accepted contract with verified collections. Progress is COUNTED from these rows.
CREATE TABLE expansion_client_qualifications (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 client_id integer NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 contract_id uuid NOT NULL REFERENCES expansion_contracts(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK (status IN ('qualified','rejected','revoked')),
 programme_version integer REFERENCES expansion_achievement_programmes(version) ON DELETE RESTRICT,
 net_collected_pence bigint NOT NULL CHECK (net_collected_pence >= 0), note text NOT NULL,
 decided_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, decided_at timestamptz NOT NULL DEFAULT now(),
 revoked_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, revoked_at timestamptz, revoke_reason text,
 CHECK ((status = 'revoked') = (revoked_at IS NOT NULL AND revoke_reason IS NOT NULL AND revoked_by IS NOT NULL)),
 CHECK (status <> 'qualified' OR net_collected_pence > 0)
);
-- The same canonical client, and the same contract, can be counted once (a client cannot qualify for two partners either).
CREATE UNIQUE INDEX expansion_qualification_live_client ON expansion_client_qualifications(client_id) WHERE status = 'qualified';
CREATE UNIQUE INDEX expansion_qualification_live_contract ON expansion_client_qualifications(contract_id) WHERE status = 'qualified';
CREATE FUNCTION expansion_qualification_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Qualification history is append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.client_id <> OLD.client_id OR NEW.contract_id <> OLD.contract_id
     OR NEW.net_collected_pence <> OLD.net_collected_pence OR NEW.note <> OLD.note OR NEW.decided_by <> OLD.decided_by OR NEW.decided_at <> OLD.decided_at THEN
    RAISE EXCEPTION 'A qualification decision is immutable; revoke it and decide again';
  END IF;
  IF NOT (OLD.status = 'qualified' AND NEW.status = 'revoked') THEN RAISE EXCEPTION 'Only a qualified client can be revoked'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_qualification_guard BEFORE UPDATE OR DELETE ON expansion_client_qualifications FOR EACH ROW EXECUTE FUNCTION expansion_qualification_guard();
-- The contract must belong to the partner.
CREATE FUNCTION expansion_qualification_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM expansion_contracts c JOIN expansion_opportunities o ON o.id = c.opportunity_id WHERE c.id = NEW.contract_id AND o.partner_id = NEW.partner_id AND c.client_id = NEW.client_id) THEN
    RAISE EXCEPTION 'The contract and client must belong to this partner';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_qualification_owner BEFORE INSERT ON expansion_client_qualifications FOR EACH ROW EXECUTE FUNCTION expansion_qualification_owner();

CREATE TABLE expansion_achievement_rewards (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 programme_version integer REFERENCES expansion_achievement_programmes(version) ON DELETE RESTRICT,
 milestone_clients integer NOT NULL CHECK (milestone_clients > 0), kind text NOT NULL CHECK (kind IN ('polo','webpage','bonus')),
 reward_pence integer NOT NULL DEFAULT 0 CHECK (reward_pence >= 0), label text NOT NULL,
 status text NOT NULL DEFAULT 'conditional' CHECK (status IN ('conditional','under_review','approved','fulfilment_pending','fulfilled','rejected')),
 review_note text, reviewed_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, fulfilled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind = 'bonus') = (reward_pence > 0))
);
-- One reward per partner, programme version and milestone: duplicates are impossible, and a replayed sync is a no-op.
CREATE UNIQUE INDEX expansion_reward_once ON expansion_achievement_rewards(partner_id, COALESCE(programme_version, 0), milestone_clients);
CREATE FUNCTION expansion_reward_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Rewards are append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.milestone_clients <> OLD.milestone_clients
     OR NEW.kind <> OLD.kind OR NEW.reward_pence <> OLD.reward_pence THEN RAISE EXCEPTION 'Reward terms are immutable'; END IF;
  -- A reward created while only the planned schedule existed may adopt an approved programme version ONCE, and only if that
  -- programme defines the same milestone with the same kind and amount.
  IF NEW.programme_version IS DISTINCT FROM OLD.programme_version THEN
    IF OLD.programme_version IS NOT NULL OR NOT EXISTS (SELECT 1 FROM expansion_achievement_milestones m JOIN expansion_achievement_programmes p ON p.version = m.programme_version
        WHERE m.programme_version = NEW.programme_version AND p.approved AND m.clients = NEW.milestone_clients AND m.kind = NEW.kind AND m.reward_pence = NEW.reward_pence) THEN
      RAISE EXCEPTION 'A reward can only adopt an approved programme that defines the same milestone and amount';
    END IF;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT ((OLD.status = 'conditional' AND NEW.status IN ('under_review','rejected'))
       OR (OLD.status = 'under_review' AND NEW.status IN ('approved','rejected'))
       OR (OLD.status = 'approved' AND NEW.status IN ('fulfilment_pending','fulfilled'))
       OR (OLD.status = 'fulfilment_pending' AND NEW.status = 'fulfilled')) THEN
    RAISE EXCEPTION 'Invalid reward transition from % to %', OLD.status, NEW.status;
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
CREATE TRIGGER expansion_reward_guard BEFORE UPDATE OR DELETE ON expansion_achievement_rewards FOR EACH ROW EXECUTE FUNCTION expansion_reward_guard();

-- Referrals: an attribution is recorded once, by a founder, before the applicant is activated, and can never be reassigned.
CREATE TABLE expansion_referral_codes (
 partner_id uuid PRIMARY KEY REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 code text NOT NULL UNIQUE CHECK (code ~ '^SS-[A-Z2-7]{8}$'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE expansion_referrals (
 id uuid PRIMARY KEY, referrer_partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 application_id integer NOT NULL UNIQUE REFERENCES partner_applications(id) ON DELETE RESTRICT,
 code text NOT NULL, attributed_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION expansion_referral_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE referrer RECORD; applicant RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Referral attributions are immutable'; END IF;
  SELECT p.application_id, u.email INTO referrer FROM expansion_partners p JOIN admin_users u ON u.id = p.user_id WHERE p.id = NEW.referrer_partner_id;
  SELECT email, status INTO applicant FROM partner_applications WHERE id = NEW.application_id;
  IF referrer.application_id = NEW.application_id OR lower(applicant.email) = lower(referrer.email) THEN RAISE EXCEPTION 'A partner cannot refer themselves'; END IF;
  IF EXISTS (SELECT 1 FROM expansion_partners WHERE application_id = NEW.application_id) OR applicant.status IN ('activated','declined','withdrawn','archived') THEN
    RAISE EXCEPTION 'Referral attribution must be recorded before the applicant is activated, while the application is open';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_referral_guard BEFORE INSERT OR UPDATE OR DELETE ON expansion_referrals FOR EACH ROW EXECUTE FUNCTION expansion_referral_guard();
CREATE TABLE expansion_referral_rewards (
 id uuid PRIMARY KEY, referral_id uuid NOT NULL UNIQUE REFERENCES expansion_referrals(id) ON DELETE RESTRICT,
 amount_pence integer NOT NULL DEFAULT 25000 CHECK (amount_pence = 25000),
 programme_version integer REFERENCES expansion_achievement_programmes(version) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'conditional' CHECK (status IN ('conditional','under_review','approved','fulfilled','rejected')),
 review_note text, reviewed_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION expansion_referral_reward_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Referral rewards are append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.referral_id <> OLD.referral_id OR NEW.amount_pence <> OLD.amount_pence THEN RAISE EXCEPTION 'Referral reward terms are immutable'; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT ((OLD.status = 'conditional' AND NEW.status IN ('under_review','rejected'))
       OR (OLD.status = 'under_review' AND NEW.status IN ('approved','rejected'))
       OR (OLD.status = 'approved' AND NEW.status = 'fulfilled')) THEN RAISE EXCEPTION 'Invalid referral reward transition from % to %', OLD.status, NEW.status; END IF;
  IF NEW.status IN ('approved','fulfilled') THEN
    IF NEW.programme_version IS NULL OR NOT EXISTS (SELECT 1 FROM expansion_achievement_programmes p WHERE p.version = NEW.programme_version AND p.approved AND p.referral_rewards_enabled) THEN
      RAISE EXCEPTION 'Referral rewards are not enabled under an approved programme version';
    END IF;
    IF NEW.reviewed_by IS NULL THEN RAISE EXCEPTION 'A founder decision is required'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_referral_reward_guard BEFORE UPDATE OR DELETE ON expansion_referral_rewards FOR EACH ROW EXECUTE FUNCTION expansion_referral_reward_guard();
