-- Operation EMPOWER B2.10: persisted partner onboarding acknowledgements (forward-only, additive).
-- A row records that the partner themself acknowledged a required onboarding step. Agreement acceptance is NOT recorded
-- here: it is derived from the versioned agreement acceptance record. No row grants any commercial right, activates a
-- partner, changes commission or sends a message. Rows are append-only: a step cannot be un-acknowledged or re-dated.
CREATE TABLE expansion_onboarding_progress (
 partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 step_key text NOT NULL CHECK (step_key IN ('how_you_earn','commercial_boundaries','approved_markets')),
 completed_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 completed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (partner_id, step_key)
);
CREATE FUNCTION expansion_onboarding_progress_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'expansion_onboarding_progress is append-only';
END $$;
CREATE TRIGGER expansion_onboarding_progress_no_change BEFORE UPDATE OR DELETE ON expansion_onboarding_progress
 FOR EACH ROW EXECUTE FUNCTION expansion_onboarding_progress_immutable();
