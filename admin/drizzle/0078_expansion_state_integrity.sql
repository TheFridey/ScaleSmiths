-- Operation Intelligence checkpoint 4A: database-enforced state integrity (forward-only).
-- 1. Withdrawal requests: only legitimate transitions, tied to the real payout.
CREATE OR REPLACE FUNCTION expansion_withdrawal_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Withdrawal requests are append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.amount_pence <> OLD.amount_pence OR NEW.policy_version <> OLD.policy_version
     OR NEW.invoice_reference IS DISTINCT FROM OLD.invoice_reference OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Requested withdrawal terms are immutable';
  END IF;
  IF OLD.status IN ('rejected','cancelled') THEN RAISE EXCEPTION 'A closed withdrawal request cannot change'; END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.payout_id IS DISTINCT FROM OLD.payout_id THEN RAISE EXCEPTION 'A prepared payout cannot be swapped on a request'; END IF;
    IF OLD.reviewed_by IS NOT NULL AND NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN RAISE EXCEPTION 'The reviewing founder cannot be rewritten'; END IF;
    RETURN NEW;
  END IF;
  IF NOT ((OLD.status = 'submitted' AND NEW.status IN ('approved','rejected','cancelled'))
       OR (OLD.status = 'approved' AND NEW.status IN ('payout_prepared','rejected','cancelled'))
       OR (OLD.status = 'payout_prepared' AND NEW.status = 'approved')) THEN
    RAISE EXCEPTION 'Invalid withdrawal transition from % to %', OLD.status, NEW.status;
  END IF;
  IF OLD.status = 'submitted' AND NEW.status IN ('approved','rejected') AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) THEN
    RAISE EXCEPTION 'A founder review must be recorded';
  END IF;
  IF NEW.status = 'payout_prepared' THEN
    SELECT * INTO p FROM expansion_payouts WHERE id = NEW.payout_id FOR UPDATE;
    IF NOT FOUND OR p.partner_id <> NEW.partner_id OR p.amount_pence <> NEW.amount_pence OR p.status <> 'prepared'
       OR EXISTS (SELECT 1 FROM expansion_payout_cancellations WHERE payout_id = NEW.payout_id) THEN
      RAISE EXCEPTION 'The payout must be this partner''s prepared payout for exactly the requested amount';
    END IF;
  END IF;
  IF OLD.status = 'payout_prepared' AND NEW.status = 'approved' THEN
    IF NEW.payout_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM expansion_payout_cancellations WHERE payout_id = OLD.payout_id) THEN
      RAISE EXCEPTION 'A prepared request returns to approved only when its payout was cancelled';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 2. Exclusivity: accepted terms are immutable. A correction is a NEW record that supersedes the old one; early expiry is an auditable end.
ALTER TABLE expansion_exclusivities ADD COLUMN superseded_by uuid REFERENCES expansion_exclusivities(id) ON DELETE RESTRICT;
CREATE FUNCTION expansion_exclusivity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Exclusivity history is append-only'; END IF;
  IF OLD.status = 'ended' THEN RAISE EXCEPTION 'An ended exclusivity cannot change'; END IF;
  IF NEW.id <> OLD.id OR NEW.client_id <> OLD.client_id OR NEW.sector <> OLD.sector OR NEW.area <> OLD.area
     OR NEW.contractual_reference <> OLD.contractual_reference OR NEW.effective_from <> OLD.effective_from
     OR NEW.effective_to IS DISTINCT FROM OLD.effective_to OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Accepted exclusivity terms are immutable; supersede them with a new record';
  END IF;
  IF NEW.status <> 'ended' THEN RAISE EXCEPTION 'An active exclusivity can only be ended'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_exclusivity_guard BEFORE UPDATE OR DELETE ON expansion_exclusivities FOR EACH ROW EXECUTE FUNCTION expansion_exclusivity_guard();
