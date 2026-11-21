-- Operation Launch Ready: versioned partner agreements, explicit partner acceptance, and an enforced application lifecycle.
--
-- * An agreement is B1.1 governed content of kind 'agreement' (partner-only, commercial review cadence). It inherits
--   draft-only editing, append-only approvals, the two-founder rule, immutable publication, supersession and withdrawal.
-- * An invitation binds one published agreement version to the partner (expansion_partners.agreement_content_version_id).
-- * Acceptance is an append-only row. Version, title, SHA-256 of the exact text and the timestamp are taken by the
--   database, never from the request, so acceptance cannot be backdated or made against altered text.
-- * Activation is impossible unless the partner accepted the version issued to them and that version is still published
--   and within its review date. A withdrawn or superseded agreement therefore cannot activate an account.
-- * Application status changes follow an explicit transition map, enforced here as well as in the service.

ALTER TABLE empower_content_items DROP CONSTRAINT empower_content_items_kind_check;
ALTER TABLE empower_content_items ADD CONSTRAINT empower_content_items_kind_check CHECK (kind IN ('resource','lesson','knowledge','objection','template','course','agreement'));
ALTER TABLE empower_content_items ADD CONSTRAINT empower_content_items_agreement_policy CHECK (kind <> 'agreement' OR (audience = 'partner_only' AND review_cadence_months = 3));

CREATE FUNCTION partner_agreement_digest(p_title text, p_body text) RETURNS text LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT encode(sha256(convert_to(p_title || E'\n\n' || p_body, 'UTF8')), 'hex') $$;

-- Current means: an agreement, published, and not past its founder review date (UTC calendar day).
CREATE FUNCTION partner_agreement_current(p_version uuid) RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM empower_content_versions cv JOIN empower_content_items ci ON ci.id = cv.item_id
  WHERE cv.id = p_version AND ci.kind = 'agreement' AND cv.status = 'published' AND cv.review_by >= (now() AT TIME ZONE 'UTC')::date) $$;

ALTER TABLE expansion_partners ADD COLUMN agreement_content_version_id uuid REFERENCES empower_content_versions(id) ON DELETE RESTRICT;
ALTER TABLE expansion_partners ADD COLUMN agreement_acceptance_id uuid;

CREATE TABLE partner_agreement_acceptances (
 id uuid PRIMARY KEY,
 partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 content_version_id uuid NOT NULL REFERENCES empower_content_versions(id) ON DELETE RESTRICT,
 agreement_slug text NOT NULL,
 agreement_version integer NOT NULL CHECK (agreement_version > 0),
 agreement_title text NOT NULL,
 content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
 signatory_name text NOT NULL CHECK (char_length(btrim(signatory_name)) BETWEEN 2 AND 120),
 statement text NOT NULL CHECK (char_length(statement) BETWEEN 20 AND 1000),
 method text NOT NULL CHECK (method IN ('activation','reissue')),
 accepted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (partner_id, content_version_id)
);
CREATE INDEX partner_agreement_acceptances_version_idx ON partner_agreement_acceptances (content_version_id);
ALTER TABLE expansion_partners ADD CONSTRAINT expansion_partners_agreement_acceptance_fk FOREIGN KEY (agreement_acceptance_id) REFERENCES partner_agreement_acceptances(id) ON DELETE RESTRICT;

CREATE FUNCTION partner_agreement_acceptance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  partner record;
  doc record;
BEGIN
  SELECT ep.user_id, ep.activated_at, ep.agreement_content_version_id, u.role, u.active INTO partner
    FROM expansion_partners ep JOIN admin_users u ON u.id = ep.user_id WHERE ep.id = NEW.partner_id FOR UPDATE OF ep;
  IF NOT FOUND OR partner.user_id <> NEW.user_id OR partner.role <> 'independent_partner' THEN
    RAISE EXCEPTION 'An agreement can be accepted only by the partner it was issued to' USING ERRCODE = 'check_violation';
  END IF;
  IF partner.agreement_content_version_id IS DISTINCT FROM NEW.content_version_id THEN
    RAISE EXCEPTION 'Only the agreement version issued to this partner can be accepted' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT partner_agreement_current(NEW.content_version_id) THEN
    RAISE EXCEPTION 'This agreement version is not currently published' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.method = 'activation' AND (partner.activated_at IS NOT NULL OR partner.active) THEN
    RAISE EXCEPTION 'Activation acceptance applies only before activation' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.method = 'reissue' AND (partner.activated_at IS NULL OR NOT partner.active) THEN
    RAISE EXCEPTION 'A reissued agreement is accepted by an active partner' USING ERRCODE = 'check_violation';
  END IF;
  SELECT ci.slug, cv.version, cv.title, partner_agreement_digest(cv.title, cv.body) AS digest INTO doc
    FROM empower_content_versions cv JOIN empower_content_items ci ON ci.id = cv.item_id WHERE cv.id = NEW.content_version_id;
  NEW.agreement_slug := doc.slug;
  NEW.agreement_version := doc.version;
  NEW.agreement_title := doc.title;
  NEW.content_sha256 := doc.digest;
  NEW.accepted_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER partner_agreement_acceptance_guard BEFORE INSERT ON partner_agreement_acceptances FOR EACH ROW EXECUTE FUNCTION partner_agreement_acceptance_guard();
CREATE TRIGGER partner_agreement_acceptances_immutable BEFORE UPDATE OR DELETE ON partner_agreement_acceptances FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

-- agreement_content_version_id is the version currently issued; agreement_acceptance_id is the latest accepted.
-- They differ while a reissued agreement awaits acceptance.
CREATE FUNCTION expansion_partner_agreement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  acceptance record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.agreement_acceptance_id IS NOT NULL THEN
      RAISE EXCEPTION 'An acceptance cannot be attached when a partner is created' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.agreement_content_version_id IS NOT NULL AND NEW.activated_at IS NOT NULL THEN
      RAISE EXCEPTION 'A partner bound to an agreement is activated only by accepting it' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.agreement_content_version_id IS NOT NULL AND NOT partner_agreement_current(NEW.agreement_content_version_id) THEN
      RAISE EXCEPTION 'An invitation must issue a currently published agreement' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.agreement_content_version_id IS DISTINCT FROM OLD.agreement_content_version_id THEN
    IF NEW.agreement_content_version_id IS NULL THEN
      RAISE EXCEPTION 'An issued agreement cannot be removed' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT partner_agreement_current(NEW.agreement_content_version_id) THEN
      RAISE EXCEPTION 'Only a currently published agreement can be issued' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.agreement_acceptance_id IS DISTINCT FROM OLD.agreement_acceptance_id THEN
    SELECT partner_id, content_version_id INTO acceptance FROM partner_agreement_acceptances WHERE id = NEW.agreement_acceptance_id;
    IF NOT FOUND OR acceptance.partner_id <> NEW.id OR acceptance.content_version_id IS DISTINCT FROM NEW.agreement_content_version_id THEN
      RAISE EXCEPTION 'The recorded acceptance must be this partner''s acceptance of the issued version' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.activated_at IS DISTINCT FROM OLD.activated_at THEN
    IF OLD.activated_at IS NOT NULL THEN
      RAISE EXCEPTION 'Activation time cannot be changed' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.agreement_content_version_id IS NULL OR NEW.agreement_acceptance_id IS NULL THEN
      RAISE EXCEPTION 'A partner can be activated only after accepting the issued agreement' USING ERRCODE = 'check_violation';
    END IF;
    SELECT content_version_id INTO acceptance FROM partner_agreement_acceptances WHERE id = NEW.agreement_acceptance_id;
    IF acceptance.content_version_id IS DISTINCT FROM NEW.agreement_content_version_id OR NOT partner_agreement_current(NEW.agreement_content_version_id) THEN
      RAISE EXCEPTION 'The accepted agreement is no longer current' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_partners_agreement_guard BEFORE INSERT OR UPDATE ON expansion_partners FOR EACH ROW EXECUTE FUNCTION expansion_partner_agreement_guard();

-- 'information_requested': a founder has asked the applicant for more detail.
ALTER TABLE partner_applications DROP CONSTRAINT partner_applications_status_check;
ALTER TABLE partner_applications ADD CONSTRAINT partner_applications_status_check CHECK (status IN ('submitted','under_review','information_requested','conversation_arranged','assessment_in_progress','approved_in_principle','agreement_pending','onboarding','activated','declined','withdrawn','archived'));

CREATE FUNCTION partner_application_transition_allowed(p_from text, p_to text) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT p_from = p_to OR p_to = ANY (CASE p_from
  WHEN 'submitted' THEN ARRAY['under_review','declined','withdrawn','archived']
  WHEN 'under_review' THEN ARRAY['information_requested','conversation_arranged','assessment_in_progress','approved_in_principle','declined','withdrawn','archived']
  WHEN 'information_requested' THEN ARRAY['under_review','conversation_arranged','assessment_in_progress','declined','withdrawn','archived']
  WHEN 'conversation_arranged' THEN ARRAY['under_review','information_requested','assessment_in_progress','approved_in_principle','declined','withdrawn','archived']
  WHEN 'assessment_in_progress' THEN ARRAY['under_review','information_requested','conversation_arranged','approved_in_principle','declined','withdrawn','archived']
  WHEN 'approved_in_principle' THEN ARRAY['assessment_in_progress','agreement_pending','declined','withdrawn','archived']
  WHEN 'agreement_pending' THEN ARRAY['approved_in_principle','onboarding','declined','withdrawn','archived']
  WHEN 'onboarding' THEN ARRAY['agreement_pending','activated','declined','withdrawn','archived']
  WHEN 'declined' THEN ARRAY['under_review','archived']
  WHEN 'withdrawn' THEN ARRAY['under_review','archived']
  ELSE ARRAY[]::text[] END) $$;

CREATE FUNCTION partner_application_transition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT partner_application_transition_allowed(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'An application cannot move from % to %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'onboarding' AND NOT (NEW.onboarding_confirmations @> '{"agreement":true,"legal":true,"independentStatus":true,"operations":true}'::jsonb) THEN
    RAISE EXCEPTION 'Every founder onboarding confirmation is required before onboarding' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'activated' AND NOT EXISTS (SELECT 1 FROM expansion_partners WHERE application_id = NEW.id AND activated_at IS NOT NULL AND agreement_acceptance_id IS NOT NULL) THEN
    RAISE EXCEPTION 'An application is activated only when its partner accepts the issued agreement' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER partner_application_transition_guard BEFORE UPDATE OF status ON partner_applications FOR EACH ROW EXECUTE FUNCTION partner_application_transition_guard();
