-- Operation Intelligence B0 merge remediation (forward-only): geographic taxonomy and audited domain release (0089 holds the public-view change).
-- 1. Founder-approved geographic taxonomy, so region/city containment is decided from policy, never from wording.
CREATE TABLE expansion_areas (
 id uuid PRIMARY KEY, key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9-]{2,60}$'), label text NOT NULL,
 parent_id uuid REFERENCES expansion_areas(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (parent_id IS NULL OR parent_id <> id)
);
-- Areas and aliases are append-only. A parent must already exist, so the tree can never contain a cycle. Siblings are treated as non-overlapping
-- by founder policy, so a founder must model overlapping geographies as one area or as nested areas.
CREATE TRIGGER expansion_areas_immutable BEFORE UPDATE OR DELETE ON expansion_areas FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE TABLE expansion_area_aliases (
 alias text PRIMARY KEY CHECK (alias = lower(alias) AND alias ~ '^[a-z0-9 ]{2,80}$'),
 area_id uuid NOT NULL REFERENCES expansion_areas(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_area_aliases_immutable BEFORE UPDATE OR DELETE ON expansion_area_aliases FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

-- 2. Audited release of a domain held by a withdrawn, research-originated opportunity whose candidate was excluded.
-- The opportunity, its prospect and the partner history all stay; only the domain stops being held. Suppression and existing-client checks are untouched.
ALTER TABLE expansion_opportunities ADD COLUMN domain_released_at timestamptz, ADD COLUMN domain_released_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, ADD COLUMN domain_release_reason text;
ALTER TABLE expansion_opportunities ADD CONSTRAINT expansion_domain_release_complete CHECK ((domain_released_at IS NULL) = (domain_released_by IS NULL AND domain_release_reason IS NULL));
DROP INDEX expansion_opportunities_domain_primary;
CREATE UNIQUE INDEX expansion_opportunities_domain_primary ON expansion_opportunities(normalized_domain) WHERE additional_claim_id IS NULL AND domain_released_at IS NULL;
ALTER TABLE expansion_candidate_events DROP CONSTRAINT expansion_candidate_events_event_check;
ALTER TABLE expansion_candidate_events ADD CONSTRAINT expansion_candidate_events_event_check CHECK (event IN ('created','edited','checked','screening_recorded','marked_eligible','exclusivity_cleared','allocated','released','reassigned','excluded','allocation_refused','domain_released'));
CREATE FUNCTION expansion_domain_release_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.domain_released_at IS NOT NULL THEN
    IF NEW.domain_released_at IS DISTINCT FROM OLD.domain_released_at OR NEW.domain_released_by IS DISTINCT FROM OLD.domain_released_by
       OR NEW.domain_release_reason IS DISTINCT FROM OLD.domain_release_reason THEN RAISE EXCEPTION 'A domain release is permanent history'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.domain_released_at IS NULL THEN RETURN NEW; END IF;
  IF OLD.research_candidate_id IS NULL OR OLD.status <> 'withdrawn' OR OLD.additional_claim_id IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM expansion_research_candidates c WHERE c.id = OLD.research_candidate_id AND c.status = 'excluded')
     OR EXISTS (SELECT 1 FROM expansion_contracts k WHERE k.opportunity_id = OLD.id)
     OR OLD.discovery <> '{}'::jsonb OR OLD.scope <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Only the domain of a withdrawn, unworked prospect from an excluded research candidate can be released';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_domain_release_guard BEFORE UPDATE OF domain_released_at, domain_released_by, domain_release_reason ON expansion_opportunities FOR EACH ROW EXECUTE FUNCTION expansion_domain_release_guard();
