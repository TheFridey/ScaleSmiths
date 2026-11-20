-- Operation Intelligence B0 merge remediation (forward-only): the domain-release guard checks everything the owner guard checks, and covers INSERT.
CREATE OR REPLACE FUNCTION expansion_domain_release_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.domain_released_at IS NOT NULL THEN
    IF NEW.domain_released_at IS DISTINCT FROM OLD.domain_released_at OR NEW.domain_released_by IS DISTINCT FROM OLD.domain_released_by
       OR NEW.domain_release_reason IS DISTINCT FROM OLD.domain_release_reason THEN RAISE EXCEPTION 'A domain release is permanent history'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.domain_released_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'A domain can be released only for an existing, withdrawn, unworked prospect'; END IF;
  IF NEW.domain_release_reason IS NULL OR char_length(NEW.domain_release_reason) < 5 THEN RAISE EXCEPTION 'A domain release needs a recorded reason'; END IF;
  IF OLD.research_candidate_id IS NULL OR OLD.status <> 'withdrawn' OR OLD.additional_claim_id IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM expansion_research_candidates c WHERE c.id = OLD.research_candidate_id AND c.status = 'excluded')
     OR OLD.discovery <> '{}'::jsonb OR OLD.scope <> '{}'::jsonb OR OLD.scope_version <> 0
     OR EXISTS (SELECT 1 FROM expansion_contracts WHERE opportunity_id = OLD.id)
     OR EXISTS (SELECT 1 FROM expansion_reservations WHERE opportunity_id = OLD.id)
     OR EXISTS (SELECT 1 FROM expansion_meeting_requests WHERE opportunity_id = OLD.id)
     OR EXISTS (SELECT 1 FROM expansion_discount_reservations WHERE opportunity_id = OLD.id) THEN
    RAISE EXCEPTION 'Only the domain of a withdrawn, unworked prospect from an excluded research candidate can be released';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER expansion_domain_release_guard ON expansion_opportunities;
CREATE TRIGGER expansion_domain_release_guard BEFORE INSERT OR UPDATE OF domain_released_at, domain_released_by, domain_release_reason ON expansion_opportunities FOR EACH ROW EXECUTE FUNCTION expansion_domain_release_guard();
