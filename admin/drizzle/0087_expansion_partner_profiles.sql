-- Operation Intelligence checkpoint 5 (forward-only): personal partner webpages.
-- Partners prepare a draft, record consent, a founder reviews, approved content is frozen as an immutable version, and a founder publishes it.
-- Public readers (the web role) can read ONLY the narrow security-barrier view at the end of this file: no private partner table is granted.
CREATE TABLE expansion_profile_slugs (
 slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' AND slug !~ '--'
   AND slug NOT IN ('admin','api','apply','about','login','logout','partner','partners','scalesmiths','scale-smiths','team','support','contact','legal','privacy','terms','security','official','founder','founders','staff','help','www','mail','status','verify','recognition','founding-partner','new','edit','settings','blog','insights','faq','sitemap','robots','static','assets','public','null','undefined')),
 partner_id uuid NOT NULL UNIQUE REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
-- A slug belongs to one partner for ever, even after revocation, so a name can never be re-bound to someone else.
CREATE TRIGGER expansion_profile_slugs_immutable BEFORE UPDATE OR DELETE ON expansion_profile_slugs FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

CREATE TABLE expansion_profile_versions (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT, version integer NOT NULL CHECK (version > 0),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','changes_requested','approved','rejected','superseded')),
 display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
 biography text NOT NULL CHECK (char_length(biography) BETWEEN 20 AND 1200),
 operating_area text NOT NULL CHECK (char_length(operating_area) BETWEEN 2 AND 120),
 enquiry_mode text NOT NULL DEFAULT 'scalesmiths_contact' CHECK (enquiry_mode IN ('scalesmiths_contact','referral_code')),
 content_hash text NOT NULL,
 consent_at timestamptz, consent_version text, consent_hash text,
 submitted_at timestamptz, reviewed_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, reviewed_at timestamptz, review_note text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (partner_id, version),
 CHECK (consent_at IS NULL OR (consent_version IS NOT NULL AND consent_hash IS NOT NULL)),
 CHECK (status NOT IN ('submitted','approved') OR (consent_at IS NOT NULL AND consent_hash = content_hash AND submitted_at IS NOT NULL)),
 CHECK (status NOT IN ('approved','rejected','changes_requested') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL))
);
CREATE UNIQUE INDEX expansion_profile_versions_open ON expansion_profile_versions(partner_id) WHERE status IN ('draft','submitted','changes_requested');
CREATE FUNCTION expansion_profile_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entitled boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Profile versions are append-only'; END IF;
  NEW.content_hash := encode(digest(concat_ws('|', NEW.display_name, NEW.biography, NEW.operating_area, NEW.enquiry_mode), 'sha256'), 'hex');
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'A profile version starts as a draft'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.version <> OLD.version OR NEW.created_at <> OLD.created_at THEN RAISE EXCEPTION 'Profile identity is immutable'; END IF;
  IF OLD.status IN ('approved','rejected','superseded') AND NOT (OLD.status = 'approved' AND NEW.status = 'superseded') THEN RAISE EXCEPTION 'An approved or closed profile version is immutable'; END IF;
  IF OLD.status IN ('approved') AND NEW.status = 'superseded' AND (NEW.display_name <> OLD.display_name OR NEW.biography <> OLD.biography OR NEW.operating_area <> OLD.operating_area OR NEW.enquiry_mode <> OLD.enquiry_mode) THEN RAISE EXCEPTION 'An approved profile version is immutable'; END IF;
  IF OLD.status = 'submitted' AND NEW.status = 'submitted' THEN RAISE EXCEPTION 'A submitted profile is frozen while it is reviewed'; END IF;
  IF NEW.content_hash <> OLD.content_hash AND NEW.status IN ('draft','changes_requested') THEN
    NEW.consent_at := NULL; NEW.consent_version := NULL; NEW.consent_hash := NULL;   -- consent covers exactly the wording it was given for
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status IN ('draft','changes_requested') AND NEW.status = 'submitted')
    OR (OLD.status = 'submitted' AND NEW.status IN ('approved','changes_requested','rejected'))
    OR (OLD.status = 'changes_requested' AND NEW.status = 'draft')
    OR (OLD.status = 'approved' AND NEW.status = 'superseded')) THEN
    RAISE EXCEPTION 'Invalid profile transition from % to %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'approved' THEN
    SELECT EXISTS (SELECT 1 FROM expansion_achievement_rewards r WHERE r.partner_id = NEW.partner_id AND r.kind = 'webpage' AND r.status IN ('approved','fulfilment_pending','fulfilled')) INTO entitled;
    IF NOT entitled THEN RAISE EXCEPTION 'A personal webpage needs an approved reward under an approved programme version'; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_profile_version_guard BEFORE INSERT OR UPDATE OR DELETE ON expansion_profile_versions FOR EACH ROW EXECUTE FUNCTION expansion_profile_version_guard();

CREATE TABLE expansion_profile_publications (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 version_id uuid NOT NULL UNIQUE REFERENCES expansion_profile_versions(id) ON DELETE RESTRICT,
 slug text NOT NULL REFERENCES expansion_profile_slugs(slug) ON DELETE RESTRICT,
 display_name text NOT NULL, biography text NOT NULL, operating_area text NOT NULL, enquiry_mode text NOT NULL,
 achievements text[] NOT NULL DEFAULT '{}' CHECK (cardinality(achievements) <= 8),
 status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','superseded','revoked')),
 published_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, published_at timestamptz NOT NULL DEFAULT now(),
 ended_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, ended_at timestamptz, end_reason text,
 CHECK ((status = 'live') = (ended_at IS NULL)),
 CHECK (status <> 'revoked' OR end_reason IS NOT NULL)
);
CREATE UNIQUE INDEX expansion_profile_publications_live_partner ON expansion_profile_publications(partner_id) WHERE status = 'live';
CREATE UNIQUE INDEX expansion_profile_publications_live_slug ON expansion_profile_publications(slug) WHERE status = 'live';
CREATE FUNCTION expansion_profile_publication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Publications are append-only'; END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v FROM expansion_profile_versions WHERE id = NEW.version_id;
    IF v.id IS NULL OR v.status <> 'approved' OR v.partner_id <> NEW.partner_id THEN RAISE EXCEPTION 'Only a founder-approved profile version can be published'; END IF;
    IF NEW.display_name <> v.display_name OR NEW.biography <> v.biography OR NEW.operating_area <> v.operating_area OR NEW.enquiry_mode <> v.enquiry_mode THEN RAISE EXCEPTION 'A publication must match its approved version exactly'; END IF;
    IF NOT EXISTS (SELECT 1 FROM expansion_profile_slugs s WHERE s.slug = NEW.slug AND s.partner_id = NEW.partner_id) THEN RAISE EXCEPTION 'The slug is not bound to this partner'; END IF;
    IF NOT EXISTS (SELECT 1 FROM expansion_partners p JOIN admin_users u ON u.id = p.user_id WHERE p.id = NEW.partner_id AND u.active AND p.activated_at IS NOT NULL) THEN RAISE EXCEPTION 'Only an active partner can be published'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.version_id <> OLD.version_id OR NEW.slug <> OLD.slug OR NEW.display_name <> OLD.display_name OR NEW.biography <> OLD.biography
     OR NEW.operating_area <> OLD.operating_area OR NEW.enquiry_mode <> OLD.enquiry_mode OR NEW.achievements <> OLD.achievements OR NEW.published_by <> OLD.published_by OR NEW.published_at <> OLD.published_at THEN
    RAISE EXCEPTION 'A publication is immutable; supersede or revoke it';
  END IF;
  IF OLD.status <> 'live' THEN RAISE EXCEPTION 'An ended publication cannot change'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_profile_publication_guard BEFORE INSERT OR UPDATE OR DELETE ON expansion_profile_publications FOR EACH ROW EXECUTE FUNCTION expansion_profile_publication_guard();

-- The ONLY public surface. It exposes display name, biography, operating area, enquiry mode, an opted-in referral identifier, founder-selected
-- achievement wording and founding-recognition date. Liveness is evaluated on every read: a revoked publication, a revoked partner, a revoked
-- recognition or a withdrawn webpage reward removes the page immediately, with nothing cached in the database layer.
CREATE VIEW expansion_public_partner_profiles WITH (security_barrier = true) AS
SELECT pub.slug, pub.display_name, pub.biography, pub.operating_area, pub.enquiry_mode, pub.published_at, pub.achievements,
  CASE WHEN pub.enquiry_mode = 'referral_code' THEN (SELECT c.code FROM expansion_referral_codes c WHERE c.partner_id = pub.partner_id ORDER BY c.created_at LIMIT 1) END AS referral_code,
  (SELECT r.recognition_date FROM expansion_recognitions r WHERE r.partner_id = pub.partner_id AND r.kind = 'founding_partner' AND r.status = 'approved') AS founding_recognition_date
FROM expansion_profile_publications pub
JOIN expansion_partners p ON p.id = pub.partner_id
JOIN admin_users u ON u.id = p.user_id
WHERE pub.status = 'live' AND u.active AND p.activated_at IS NOT NULL AND u.role::text = 'independent_partner'
  AND EXISTS (SELECT 1 FROM expansion_achievement_rewards r WHERE r.partner_id = pub.partner_id AND r.kind = 'webpage' AND r.status IN ('approved','fulfilment_pending','fulfilled'));
REVOKE ALL ON expansion_public_partner_profiles FROM PUBLIC;
