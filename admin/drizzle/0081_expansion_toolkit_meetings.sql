-- Operation Intelligence checkpoint 4C: onboarding fulfilment tracking and founder meeting requests (forward-only).
-- Nothing here provisions an external product or sends an invitation: both are MANUAL tracking records.
CREATE TABLE expansion_toolkit_items (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 item_key text NOT NULL CHECK (item_key IN ('email','circlecard','business_card','referral_identifier','brochures','pricing_documents','commission_documents','industry_demonstrations','researched_prospects','academy','founder_training','technical_assistance','joint_meetings','personal_webpage')),
 status text NOT NULL CHECK (status IN ('not_requested','planned','awaiting_approval','in_preparation','available','completed','unavailable')),
 detail text, resource_id uuid REFERENCES expansion_resources(id) ON DELETE RESTRICT,
 completed_at timestamptz, updated_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (partner_id, item_key),
 -- Evidence is mandatory before anything is described as available or completed.
 CHECK (status NOT IN ('available','completed') OR (detail IS NOT NULL AND length(trim(detail)) > 0)),
 CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE TABLE expansion_meeting_requests (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 opportunity_id uuid REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
 meeting_type text NOT NULL CHECK (meeting_type IN ('joint_sales','technical_scoping','bespoke_discovery','commercial_assistance','proposal_review','training','escalation')),
 preferred_slots jsonb NOT NULL CHECK (jsonb_typeof(preferred_slots) = 'array' AND jsonb_array_length(preferred_slots) BETWEEN 1 AND 5),
 time_zone text NOT NULL CHECK (length(time_zone) BETWEEN 3 AND 64), purpose text NOT NULL, context text,
 requested_founder uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','under_review','info_required','alternative_proposed','confirmed','declined','cancelled','completed')),
 founder_note text, proposed_start timestamptz, confirmed_start timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (status <> 'alternative_proposed' OR proposed_start IS NOT NULL),
 CHECK (status NOT IN ('confirmed','completed') OR confirmed_start IS NOT NULL)
);
CREATE INDEX expansion_meeting_partner_idx ON expansion_meeting_requests(partner_id, created_at);
CREATE FUNCTION expansion_meeting_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Meeting requests are append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.meeting_type <> OLD.meeting_type OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'A meeting request''s subject is immutable';
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF OLD.status IN ('declined','cancelled','completed') THEN RAISE EXCEPTION 'A closed meeting request cannot change'; END IF;
  IF NOT ((OLD.status = 'requested' AND NEW.status IN ('under_review','info_required','alternative_proposed','confirmed','declined','cancelled'))
       OR (OLD.status = 'under_review' AND NEW.status IN ('info_required','alternative_proposed','confirmed','declined','cancelled'))
       OR (OLD.status = 'info_required' AND NEW.status IN ('requested','declined','cancelled'))
       OR (OLD.status = 'alternative_proposed' AND NEW.status IN ('confirmed','requested','declined','cancelled'))
       OR (OLD.status = 'confirmed' AND NEW.status IN ('completed','cancelled'))) THEN
    RAISE EXCEPTION 'Invalid meeting transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_meeting_guard BEFORE UPDATE OR DELETE ON expansion_meeting_requests FOR EACH ROW EXECUTE FUNCTION expansion_meeting_guard();
