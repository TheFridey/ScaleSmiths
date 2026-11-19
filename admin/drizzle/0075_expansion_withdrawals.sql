-- Operation Intelligence checkpoint 3B: partner withdrawal requests over the existing commission ledger.
-- No second ledger: a request RESERVES specific ledger entries, and approved requests create ordinary
-- expansion_payouts. Reservations are append-only with a released_at marker, so the admin runtime needs no DELETE.
CREATE TABLE expansion_withdrawal_policies (
 version serial PRIMARY KEY,
 enabled boolean NOT NULL,
 min_amount_pence integer CHECK (min_amount_pence IS NULL OR min_amount_pence > 0),
 invoice_required boolean NOT NULL DEFAULT true,
 approval_reference text NOT NULL,
 approved_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_withdrawal_policies_immutable BEFORE UPDATE OR DELETE ON expansion_withdrawal_policies FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

CREATE TABLE expansion_withdrawal_requests (
 id uuid PRIMARY KEY,
 partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 policy_version integer NOT NULL REFERENCES expansion_withdrawal_policies(version) ON DELETE RESTRICT,
 amount_pence bigint NOT NULL CHECK (amount_pence > 0),
 invoice_reference text,
 status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected','cancelled','payout_prepared')),
 partner_note text, review_note text,
 reviewed_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, reviewed_at timestamptz,
 payout_id uuid UNIQUE REFERENCES expansion_payouts(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status = 'payout_prepared') = (payout_id IS NOT NULL)),
 CHECK (status IN ('submitted','cancelled') OR status <> 'rejected' OR review_note IS NOT NULL)
);
CREATE UNIQUE INDEX expansion_withdrawal_active_invoice ON expansion_withdrawal_requests(partner_id, lower(invoice_reference)) WHERE invoice_reference IS NOT NULL AND status IN ('submitted','approved','payout_prepared');
CREATE INDEX expansion_withdrawal_partner_idx ON expansion_withdrawal_requests(partner_id, created_at);
CREATE FUNCTION expansion_withdrawal_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Withdrawal requests are append-only'; END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.amount_pence <> OLD.amount_pence OR NEW.policy_version <> OLD.policy_version
     OR NEW.invoice_reference IS DISTINCT FROM OLD.invoice_reference OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Requested withdrawal terms are immutable';
  END IF;
  IF OLD.status IN ('rejected','cancelled') THEN RAISE EXCEPTION 'A closed withdrawal request cannot change'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_withdrawal_request_guard BEFORE UPDATE OR DELETE ON expansion_withdrawal_requests FOR EACH ROW EXECUTE FUNCTION expansion_withdrawal_request_guard();

CREATE TABLE expansion_withdrawal_entries (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES expansion_withdrawal_requests(id) ON DELETE RESTRICT,
 ledger_id uuid NOT NULL REFERENCES expansion_commission_ledger(id) ON DELETE RESTRICT,
 released_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (request_id, ledger_id)
);
-- The database itself guarantees a ledger entry has at most one live reservation.
CREATE UNIQUE INDEX expansion_withdrawal_live_entry ON expansion_withdrawal_entries(ledger_id) WHERE released_at IS NULL;
CREATE FUNCTION expansion_withdrawal_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM expansion_payout_claims WHERE ledger_id = NEW.ledger_id) THEN RAISE EXCEPTION 'Commission is already allocated to a payout'; END IF;
    IF NEW.released_at IS NOT NULL THEN RAISE EXCEPTION 'New reservations cannot start released'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' OR OLD.released_at IS NOT NULL OR NEW.released_at IS NULL OR NEW.id <> OLD.id OR NEW.request_id <> OLD.request_id OR NEW.ledger_id <> OLD.ledger_id THEN
    RAISE EXCEPTION 'Withdrawal reservations may only be released once';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_withdrawal_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON expansion_withdrawal_entries FOR EACH ROW EXECUTE FUNCTION expansion_withdrawal_entry_guard();

-- Reverse guard: a payout may only claim entries that are not reserved by a different withdrawal request.
CREATE FUNCTION expansion_payout_claim_withdrawal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM expansion_withdrawal_entries w JOIN expansion_withdrawal_requests r ON r.id = w.request_id
             WHERE w.ledger_id = NEW.ledger_id AND w.released_at IS NULL AND r.payout_id IS DISTINCT FROM NEW.payout_id) THEN
    RAISE EXCEPTION 'Commission is reserved by a partner withdrawal request';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_payout_claim_withdrawal_guard BEFORE INSERT ON expansion_payout_claims FOR EACH ROW EXECUTE FUNCTION expansion_payout_claim_withdrawal_guard();
