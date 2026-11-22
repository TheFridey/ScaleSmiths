-- Operation Ascend B2.1: a partner's own record of contact with a prospect they registered. Forward-only and additive.
-- Interactions are history: they are never edited or deleted (corrections are a new entry). They carry no commercial meaning,
-- never change an opportunity status and are never read by the finance engine.
CREATE TABLE expansion_opportunity_interactions (
 id uuid PRIMARY KEY,
 opportunity_id uuid NOT NULL REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
 partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN ('call','email','meeting','message','note')),
 summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 1 AND 2000),
 occurred_on date NOT NULL,
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (occurred_on <= (created_at AT TIME ZONE 'UTC')::date + 1)
);
-- The pipeline detail reads one opportunity's newest interactions; a partner only ever reads their own.
CREATE INDEX expansion_opportunity_interactions_opportunity_idx ON expansion_opportunity_interactions(opportunity_id, created_at DESC);
-- The interaction's partner must be the opportunity's partner, so an entry can never be attached to another partner's prospect.
CREATE OR REPLACE FUNCTION expansion_interaction_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM expansion_opportunities o WHERE o.id = NEW.opportunity_id AND o.partner_id = NEW.partner_id) THEN
    RAISE EXCEPTION 'interaction partner must own the opportunity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_interaction_owner BEFORE INSERT ON expansion_opportunity_interactions FOR EACH ROW EXECUTE FUNCTION expansion_interaction_owner_guard();
CREATE TRIGGER expansion_interactions_immutable BEFORE UPDATE OR DELETE ON expansion_opportunity_interactions FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
