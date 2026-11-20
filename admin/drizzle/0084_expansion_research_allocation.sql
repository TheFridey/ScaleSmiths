-- Operation Intelligence checkpoint 5 (forward-only): researched prospect allocation.
-- A candidate is founder-held research. It becomes a partner's prospect only by allocation, which creates (or revives) the
-- canonical prospect and expansion opportunity inside one transaction. Nothing here contacts a business or asserts interest.
CREATE TABLE expansion_research_candidates (
 id uuid PRIMARY KEY,
 business_name text NOT NULL CHECK (char_length(business_name) BETWEEN 2 AND 200),
 website_url text, normalized_domain text NOT NULL CHECK (char_length(normalized_domain) BETWEEN 3 AND 253),
 industry text, sector_id uuid REFERENCES expansion_sectors(id) ON DELETE RESTRICT,
 country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
 region text, area text,
 public_source text NOT NULL CHECK (char_length(public_source) BETWEEN 3 AND 500),
 researched_on date NOT NULL,
 partner_notes text, internal_notes text,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','eligible','allocated','excluded')),
 screening_status text NOT NULL DEFAULT 'pending' CHECK (screening_status IN ('pending','evidenced','failed')),
 screening_evidence text, screening_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, screening_at timestamptz,
 allocated_partner_id uuid REFERENCES expansion_partners(id) ON DELETE RESTRICT, allocated_at timestamptz,
 exclusion_reason text,
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status = 'allocated') = (allocated_partner_id IS NOT NULL AND allocated_at IS NOT NULL)),
 CHECK (status NOT IN ('eligible','allocated') OR (screening_status = 'evidenced' AND screening_evidence IS NOT NULL AND screening_by IS NOT NULL)),
 CHECK ((status = 'excluded') = (exclusion_reason IS NOT NULL))
);
-- One live candidate per business domain; an excluded record never blocks a corrected re-entry.
CREATE UNIQUE INDEX expansion_research_candidates_domain ON expansion_research_candidates(normalized_domain) WHERE status <> 'excluded';
CREATE INDEX expansion_research_candidates_partner ON expansion_research_candidates(allocated_partner_id) WHERE allocated_partner_id IS NOT NULL;
CREATE FUNCTION expansion_research_candidate_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Research candidates are append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN RAISE EXCEPTION 'A research candidate identity is immutable'; END IF;
  IF OLD.status = 'excluded' THEN RAISE EXCEPTION 'An excluded candidate is closed; record a new candidate if the position changes'; END IF;
  IF OLD.status = 'allocated' AND NEW.status = 'allocated' AND (
       NEW.business_name <> OLD.business_name OR NEW.normalized_domain <> OLD.normalized_domain OR NEW.country <> OLD.country
       OR NEW.sector_id IS DISTINCT FROM OLD.sector_id OR NEW.industry IS DISTINCT FROM OLD.industry OR NEW.region IS DISTINCT FROM OLD.region
       OR NEW.area IS DISTINCT FROM OLD.area OR NEW.public_source <> OLD.public_source OR NEW.researched_on <> OLD.researched_on
       OR NEW.partner_notes IS DISTINCT FROM OLD.partner_notes) THEN
    RAISE EXCEPTION 'Research held by a partner cannot be changed; release it first';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'draft' AND NEW.status IN ('eligible','excluded'))
    OR (OLD.status = 'eligible' AND NEW.status IN ('draft','allocated','excluded'))
    OR (OLD.status = 'allocated' AND NEW.status IN ('eligible','excluded'))) THEN
    RAISE EXCEPTION 'Invalid candidate transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_research_candidate_guard BEFORE UPDATE OR DELETE ON expansion_research_candidates FOR EACH ROW EXECUTE FUNCTION expansion_research_candidate_guard();

-- Append-only allocation and review history.
CREATE TABLE expansion_candidate_events (
 id uuid PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES expansion_research_candidates(id) ON DELETE RESTRICT,
 event text NOT NULL CHECK (event IN ('created','edited','checked','screening_recorded','marked_eligible','exclusivity_cleared','allocated','released','reassigned','excluded','allocation_refused')),
 actor_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 partner_id uuid REFERENCES expansion_partners(id) ON DELETE RESTRICT, from_partner_id uuid REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 opportunity_id uuid REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
 note text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expansion_candidate_events_candidate ON expansion_candidate_events(candidate_id, created_at);
CREATE TRIGGER expansion_candidate_events_immutable BEFORE UPDATE OR DELETE ON expansion_candidate_events FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

-- A founder's decision that a candidate may proceed despite a review-level exclusivity match. A confirmed restriction is never clearable here.
CREATE TABLE expansion_candidate_exclusivity_decisions (
 id uuid PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES expansion_research_candidates(id) ON DELETE RESTRICT,
 exclusivity_id uuid NOT NULL REFERENCES expansion_exclusivities(id) ON DELETE RESTRICT,
 reference text NOT NULL CHECK (char_length(reference) BETWEEN 3 AND 1000), decided_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (candidate_id, exclusivity_id)
);
CREATE TRIGGER expansion_candidate_exclusivity_immutable BEFORE UPDATE OR DELETE ON expansion_candidate_exclusivity_decisions FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

-- The canonical opportunity remembers where it came from. One candidate maps to at most one opportunity for its whole life.
ALTER TABLE expansion_opportunities ADD COLUMN research_candidate_id uuid UNIQUE REFERENCES expansion_research_candidates(id) ON DELETE RESTRICT;

-- A partner's ownership of an opportunity never changes by accident. Only the release/reassign service may move an UNWORKED,
-- research-originated opportunity, and the database re-checks that nothing has been built on it.
CREATE FUNCTION expansion_opportunity_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.partner_id IS NOT DISTINCT FROM OLD.partner_id THEN RETURN NEW; END IF;
  IF OLD.research_candidate_id IS NULL OR COALESCE(current_setting('app.opportunity_reassign', true), '') <> 'verified' THEN
    RAISE EXCEPTION 'An opportunity cannot change partner';
  END IF;
  IF OLD.status NOT IN ('registered','withdrawn') OR OLD.discovery <> '{}'::jsonb OR OLD.scope <> '{}'::jsonb OR OLD.scope_version <> 0
     OR EXISTS (SELECT 1 FROM expansion_contracts WHERE opportunity_id = OLD.id)
     OR EXISTS (SELECT 1 FROM expansion_reservations WHERE opportunity_id = OLD.id)
     OR EXISTS (SELECT 1 FROM expansion_meeting_requests WHERE opportunity_id = OLD.id)
     OR EXISTS (SELECT 1 FROM expansion_discount_reservations WHERE opportunity_id = OLD.id) THEN
    RAISE EXCEPTION 'Work has been recorded on this prospect; it cannot move to another partner';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_opportunity_owner_guard BEFORE UPDATE OF partner_id ON expansion_opportunities FOR EACH ROW EXECUTE FUNCTION expansion_opportunity_owner_guard();
