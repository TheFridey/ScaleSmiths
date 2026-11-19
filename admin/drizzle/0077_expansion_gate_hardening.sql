-- Operation Intelligence checkpoint 3 review fixes (forward-only; 0075/0076 are already published and untouched).
-- A customer market only counts once a founder has confirmed it; partner-supplied values stay unconfirmed.
ALTER TABLE expansion_opportunities ADD COLUMN customer_country_confirmed_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT;
-- Reservation entries must belong to the request's partner, and the ledger row is locked while the check runs.
CREATE OR REPLACE FUNCTION expansion_withdrawal_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM 1 FROM expansion_commission_ledger l JOIN expansion_withdrawal_requests r ON r.id = NEW.request_id
      WHERE l.id = NEW.ledger_id AND l.partner_id = r.partner_id FOR UPDATE OF l;
    IF NOT FOUND THEN RAISE EXCEPTION 'A reservation must use the requesting partner''s own commission'; END IF;
    IF EXISTS (SELECT 1 FROM expansion_payout_claims WHERE ledger_id = NEW.ledger_id) THEN RAISE EXCEPTION 'Commission is already allocated to a payout'; END IF;
    IF NEW.released_at IS NOT NULL THEN RAISE EXCEPTION 'New reservations cannot start released'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' OR OLD.released_at IS NOT NULL OR NEW.released_at IS NULL OR NEW.id <> OLD.id OR NEW.request_id <> OLD.request_id OR NEW.ledger_id <> OLD.ledger_id THEN
    RAISE EXCEPTION 'Withdrawal reservations may only be released once';
  END IF;
  RETURN NEW;
END $$;
