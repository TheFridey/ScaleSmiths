CREATE TABLE expansion_payment_events (
 id uuid PRIMARY KEY, contract_id uuid NOT NULL REFERENCES expansion_contracts(id) ON DELETE RESTRICT,
 commercial_payment_id integer NOT NULL UNIQUE REFERENCES commercial_payments(id) ON DELETE RESTRICT,
 reference text NOT NULL UNIQUE, milestone text NOT NULL CHECK (milestone IN ('deposit','final','first_retainer')),
 net_pence bigint NOT NULL CHECK (net_pence <> 0), gross_pence bigint NOT NULL CHECK (gross_pence <> 0),
 evidence_reference text NOT NULL, fingerprint text NOT NULL,
 reverses_event_id uuid UNIQUE REFERENCES expansion_payment_events(id) ON DELETE RESTRICT,
 terms_approval_reference text,
 verified_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((net_pence > 0 AND gross_pence >= net_pence AND reverses_event_id IS NULL) OR
        (net_pence < 0 AND gross_pence <= net_pence AND reverses_event_id IS NOT NULL AND terms_approval_reference IS NOT NULL))
);
CREATE INDEX expansion_payment_contract_idx ON expansion_payment_events(contract_id, milestone);
CREATE TABLE expansion_commission_ledger (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 contract_id uuid NOT NULL REFERENCES expansion_contracts(id) ON DELETE RESTRICT,
 payment_event_id uuid NOT NULL UNIQUE REFERENCES expansion_payment_events(id) ON DELETE RESTRICT,
 amount_pence bigint NOT NULL CHECK (amount_pence <> 0), plan_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expansion_ledger_partner_idx ON expansion_commission_ledger(partner_id,created_at);
CREATE TABLE expansion_payouts (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 amount_pence bigint NOT NULL CHECK (amount_pence > 0), invoice_reference text NOT NULL,
 status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','approved','paid')),
 prepared_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 approved_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
 approved_at timestamptz, settlement_reference text UNIQUE, paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(partner_id,invoice_reference),
 CHECK ((status='prepared' AND approved_by IS NULL AND approved_at IS NULL AND paid_at IS NULL AND settlement_reference IS NULL)
 OR (status='approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND paid_at IS NULL AND settlement_reference IS NULL)
 OR (status='paid' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND paid_at IS NOT NULL AND settlement_reference IS NOT NULL))
);
CREATE INDEX expansion_payout_partner_idx ON expansion_payouts(partner_id,created_at);
CREATE TABLE expansion_payout_entries (
 payout_id uuid NOT NULL REFERENCES expansion_payouts(id) ON DELETE RESTRICT,
 ledger_id uuid NOT NULL UNIQUE REFERENCES expansion_commission_ledger(id) ON DELETE RESTRICT,
 PRIMARY KEY(payout_id,ledger_id)
);
--> statement-breakpoint
CREATE FUNCTION expansion_financial_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Expansion financial history is append-only'; END $$;
CREATE TRIGGER expansion_events_immutable BEFORE UPDATE OR DELETE ON expansion_payment_events FOR EACH ROW EXECUTE FUNCTION expansion_financial_history_immutable();
CREATE TRIGGER expansion_ledger_immutable BEFORE UPDATE OR DELETE ON expansion_commission_ledger FOR EACH ROW EXECUTE FUNCTION expansion_financial_history_immutable();
CREATE TRIGGER expansion_payout_entries_immutable BEFORE UPDATE OR DELETE ON expansion_payout_entries FOR EACH ROW EXECUTE FUNCTION expansion_financial_history_immutable();
CREATE FUNCTION expansion_payout_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allocated bigint;
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Payout history cannot be deleted'; END IF;
 IF OLD.id <> NEW.id OR OLD.partner_id <> NEW.partner_id OR OLD.amount_pence <> NEW.amount_pence OR OLD.invoice_reference <> NEW.invoice_reference OR OLD.prepared_by <> NEW.prepared_by OR OLD.created_at <> NEW.created_at THEN RAISE EXCEPTION 'Prepared payout terms are immutable'; END IF;
 IF NOT ((OLD.status='prepared' AND NEW.status='approved') OR (OLD.status='approved' AND NEW.status='paid' AND OLD.approved_by=NEW.approved_by AND OLD.approved_at=NEW.approved_at)) THEN RAISE EXCEPTION 'Invalid payout transition'; END IF;
 SELECT coalesce(sum(l.amount_pence),0) INTO allocated FROM expansion_payout_entries e JOIN expansion_commission_ledger l ON l.id=e.ledger_id WHERE e.payout_id=OLD.id;
 IF allocated <> NEW.amount_pence THEN RAISE EXCEPTION 'Payout does not reconcile with allocated commission'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expansion_payout_lifecycle_guard BEFORE UPDATE OR DELETE ON expansion_payouts FOR EACH ROW EXECUTE FUNCTION expansion_payout_lifecycle();
CREATE FUNCTION expansion_payout_allocation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE batch expansion_payouts; entry_partner uuid;
BEGIN
 SELECT * INTO batch FROM expansion_payouts WHERE id=NEW.payout_id FOR UPDATE;
 SELECT partner_id INTO entry_partner FROM expansion_commission_ledger WHERE id=NEW.ledger_id;
 IF batch.id IS NULL OR batch.status <> 'prepared' OR entry_partner IS DISTINCT FROM batch.partner_id THEN RAISE EXCEPTION 'Commission allocation requires an unapproved payout for the same partner'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expansion_payout_allocation_guard BEFORE INSERT ON expansion_payout_entries FOR EACH ROW EXECUTE FUNCTION expansion_payout_allocation_guard();
CREATE FUNCTION expansion_reversal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.reverses_payment_id IS NOT NULL AND EXISTS (SELECT 1 FROM expansion_payment_events WHERE commercial_payment_id=NEW.reverses_payment_id) AND coalesce(current_setting('app.expansion_finance',true),'') <> 'verified' THEN RAISE EXCEPTION 'Partner collection refunds require the expansion financial reconciliation workflow'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expansion_commercial_reversal_guard BEFORE INSERT ON commercial_payments FOR EACH ROW EXECUTE FUNCTION expansion_reversal_guard();
