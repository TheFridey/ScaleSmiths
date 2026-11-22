-- Operation Ascend B2.3: which founder is handling an opportunity internally. Forward-only and additive.
-- This is internal coordination only. It never changes expansion_opportunities.partner_id, so a partner's ownership and
-- commission entitlement are untouched. History is append-only: each row supersedes exactly one earlier row, so the current
-- assignment is the one row nobody supersedes, and two founders acting on the same state cannot both succeed.
CREATE TABLE expansion_founder_assignments (
 id uuid PRIMARY KEY,
 opportunity_id uuid NOT NULL REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
 assignee_id uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
 assigned_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
 supersedes_id uuid UNIQUE REFERENCES expansion_founder_assignments(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- At most one first assignment per opportunity; every later one names the row it replaces (UNIQUE above).
CREATE UNIQUE INDEX expansion_founder_assignments_root ON expansion_founder_assignments(opportunity_id) WHERE supersedes_id IS NULL;
CREATE INDEX expansion_founder_assignments_opportunity_idx ON expansion_founder_assignments(opportunity_id, created_at DESC);
-- A row may only supersede a row for the same opportunity.
CREATE OR REPLACE FUNCTION expansion_founder_assignment_chain_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expansion_founder_assignments a WHERE a.id = NEW.supersedes_id AND a.opportunity_id = NEW.opportunity_id) THEN
    RAISE EXCEPTION 'an assignment can only supersede one for the same opportunity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_founder_assignment_chain BEFORE INSERT ON expansion_founder_assignments FOR EACH ROW EXECUTE FUNCTION expansion_founder_assignment_chain_guard();
CREATE TRIGGER expansion_founder_assignments_immutable BEFORE UPDATE OR DELETE ON expansion_founder_assignments FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
