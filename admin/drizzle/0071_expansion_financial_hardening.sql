-- Preserve ordinary full reversals while allowing bounded Expansion refunds.
ALTER TABLE commercial_payments ADD COLUMN expansion_refund boolean NOT NULL DEFAULT false;
ALTER TABLE commercial_payments DROP CONSTRAINT commercial_payments_reverses_payment_id_key;
CREATE UNIQUE INDEX commercial_payments_ordinary_reversal_idx
 ON commercial_payments(reverses_payment_id) WHERE NOT expansion_refund;
CREATE INDEX commercial_payments_refund_source_idx ON commercial_payments(reverses_payment_id);

CREATE OR REPLACE FUNCTION expansion_reversal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source commercial_payments; source_is_expansion boolean; refunded bigint;
BEGIN
 IF NEW.reverses_payment_id IS NULL THEN
  IF NEW.expansion_refund THEN RAISE EXCEPTION 'Expansion refund requires a source'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO source FROM commercial_payments WHERE id=NEW.reverses_payment_id FOR UPDATE;
 SELECT EXISTS (SELECT 1 FROM expansion_payment_events WHERE commercial_payment_id=source.id) INTO source_is_expansion;
 IF source.id IS NULL OR source.amount <= 0 OR NEW.client_id IS DISTINCT FROM source.client_id
    OR NEW.invoice_id IS DISTINCT FROM source.invoice_id OR NEW.category IS DISTINCT FROM source.category THEN
  RAISE EXCEPTION 'Refund must match the original collection';
 END IF;
 IF source_is_expansion THEN
  IF NOT NEW.expansion_refund OR coalesce(current_setting('app.expansion_finance',true),'') <> 'verified' THEN
   RAISE EXCEPTION 'Partner collection refunds require the expansion financial reconciliation workflow';
  END IF;
  SELECT coalesce(-sum(amount),0) INTO refunded FROM commercial_payments WHERE reverses_payment_id=source.id;
  IF refunded - NEW.amount > source.amount THEN RAISE EXCEPTION 'Refund exceeds original collection'; END IF;
 ELSIF NEW.expansion_refund OR NEW.amount <> -source.amount THEN
  RAISE EXCEPTION 'Ordinary payment reversal must reverse the full amount';
 END IF;
 RETURN NEW;
END $$;

ALTER TABLE expansion_payment_events DROP CONSTRAINT expansion_payment_events_reverses_event_id_key;
CREATE INDEX expansion_payment_refund_source_idx ON expansion_payment_events(reverses_event_id);
ALTER TABLE expansion_payment_events ADD COLUMN calculated_adjustment_pence bigint,
 ADD COLUMN refund_treatment text CHECK (refund_treatment IN ('manual_review','retain_entitlement','adjust_unpaid'));

CREATE FUNCTION expansion_refund_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source expansion_payment_events; cash commercial_payments; refunded_net numeric; refunded_vat numeric;
BEGIN
 IF NEW.reverses_event_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO source FROM expansion_payment_events WHERE id=NEW.reverses_event_id FOR UPDATE;
 SELECT * INTO cash FROM commercial_payments WHERE id=NEW.commercial_payment_id;
 IF source.id IS NULL OR source.net_pence <= 0 OR NEW.contract_id <> source.contract_id OR NEW.milestone <> source.milestone
    OR cash.reverses_payment_id IS DISTINCT FROM source.commercial_payment_id OR cash.amount IS DISTINCT FROM NEW.net_pence
    OR cash.reference IS DISTINCT FROM NEW.reference OR cash.expansion_refund IS DISTINCT FROM true
    OR NEW.refund_treatment IS NULL OR NEW.calculated_adjustment_pence IS NULL OR NEW.calculated_adjustment_pence > 0 THEN
  RAISE EXCEPTION 'Refund event must match canonical cash and original entitlement';
 END IF;
 SELECT coalesce(-sum(net_pence),0),coalesce(sum(net_pence-gross_pence),0)
  INTO refunded_net,refunded_vat FROM expansion_payment_events WHERE reverses_event_id=source.id;
 IF refunded_net - NEW.net_pence > source.net_pence OR
    refunded_vat + NEW.net_pence - NEW.gross_pence > source.gross_pence - source.net_pence THEN
  RAISE EXCEPTION 'Refund event exceeds original net or VAT';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expansion_refund_event_guard BEFORE INSERT ON expansion_payment_events
 FOR EACH ROW EXECUTE FUNCTION expansion_refund_event_guard();

CREATE FUNCTION expansion_require_refund_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.expansion_refund AND NOT EXISTS (SELECT 1 FROM expansion_payment_events WHERE commercial_payment_id=NEW.id) THEN
  RAISE EXCEPTION 'Canonical Expansion refund requires an event';
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER expansion_require_refund_event AFTER INSERT ON commercial_payments
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION expansion_require_refund_event();

CREATE TABLE expansion_payout_cancellations (
 payout_id uuid PRIMARY KEY REFERENCES expansion_payouts(id) ON DELETE RESTRICT,
 cancelled_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
 cancelled_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_payout_cancellation_immutable BEFORE UPDATE OR DELETE ON expansion_payout_cancellations
 FOR EACH ROW EXECUTE FUNCTION expansion_financial_history_immutable();

CREATE FUNCTION expansion_guard_payout_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_status text;
BEGIN
 SELECT status INTO current_status FROM expansion_payouts WHERE id=NEW.payout_id FOR UPDATE;
 IF current_status IS DISTINCT FROM 'prepared' THEN RAISE EXCEPTION 'Only a prepared payout may be cancelled'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expansion_payout_cancellation_guard BEFORE INSERT ON expansion_payout_cancellations
 FOR EACH ROW EXECUTE FUNCTION expansion_guard_payout_cancellation();

-- Allocations remain immutable. Only a cancellation releases a historical allocation.
ALTER TABLE expansion_payout_entries DROP CONSTRAINT expansion_payout_entries_ledger_id_key;
CREATE INDEX expansion_payout_entries_ledger_idx ON expansion_payout_entries(ledger_id);
CREATE TABLE expansion_payout_claims (
 ledger_id uuid PRIMARY KEY,
 payout_id uuid NOT NULL,
 FOREIGN KEY (payout_id,ledger_id) REFERENCES expansion_payout_entries(payout_id,ledger_id) ON DELETE RESTRICT
);
INSERT INTO expansion_payout_claims(ledger_id,payout_id)
 SELECT ledger_id,payout_id FROM expansion_payout_entries;
CREATE FUNCTION expansion_claim_payout_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO expansion_payout_claims(ledger_id,payout_id) VALUES (NEW.ledger_id,NEW.payout_id);
 RETURN NEW;
END $$;
CREATE TRIGGER expansion_claim_payout_entry AFTER INSERT ON expansion_payout_entries
 FOR EACH ROW EXECUTE FUNCTION expansion_claim_payout_entry();
CREATE FUNCTION expansion_release_payout_claims() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM expansion_payout_claims WHERE payout_id=NEW.payout_id;
 RETURN NEW;
END $$;
CREATE TRIGGER expansion_release_payout_claims AFTER INSERT ON expansion_payout_cancellations
 FOR EACH ROW EXECUTE FUNCTION expansion_release_payout_claims();
CREATE FUNCTION expansion_guard_payout_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS (SELECT 1 FROM expansion_payout_cancellations WHERE payout_id=OLD.payout_id) THEN RETURN OLD; END IF;
 ELSE
  IF TG_OP='INSERT' AND NOT EXISTS (SELECT 1 FROM expansion_payout_cancellations WHERE payout_id=NEW.payout_id) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Invalid payout claim change';
END $$;
CREATE TRIGGER expansion_guard_payout_claim BEFORE INSERT OR UPDATE OR DELETE ON expansion_payout_claims
 FOR EACH ROW EXECUTE FUNCTION expansion_guard_payout_claim();
CREATE OR REPLACE FUNCTION expansion_payout_allocation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE batch expansion_payouts; entry_partner uuid;
BEGIN
 SELECT * INTO batch FROM expansion_payouts WHERE id=NEW.payout_id FOR UPDATE;
 SELECT partner_id INTO entry_partner FROM expansion_commission_ledger WHERE id=NEW.ledger_id FOR UPDATE;
 IF batch.id IS NULL OR batch.status <> 'prepared' OR entry_partner IS DISTINCT FROM batch.partner_id
    OR EXISTS (SELECT 1 FROM expansion_payout_cancellations WHERE payout_id=NEW.payout_id)
    OR EXISTS (SELECT 1 FROM expansion_payout_entries e WHERE e.ledger_id=NEW.ledger_id
      AND NOT EXISTS (SELECT 1 FROM expansion_payout_cancellations c WHERE c.payout_id=e.payout_id)) THEN
  RAISE EXCEPTION 'Commission allocation requires an unallocated entry and a live prepared payout for the same partner';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION expansion_payout_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allocated bigint;
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Payout history cannot be deleted'; END IF;
 IF EXISTS (SELECT 1 FROM expansion_payout_cancellations WHERE payout_id=OLD.id) THEN RAISE EXCEPTION 'Cancelled payout is terminal'; END IF;
 IF OLD.id <> NEW.id OR OLD.partner_id <> NEW.partner_id OR OLD.amount_pence <> NEW.amount_pence OR OLD.invoice_reference <> NEW.invoice_reference OR OLD.prepared_by <> NEW.prepared_by OR OLD.created_at <> NEW.created_at THEN RAISE EXCEPTION 'Prepared payout terms are immutable'; END IF;
 IF NOT ((OLD.status='prepared' AND NEW.status='approved') OR (OLD.status='approved' AND NEW.status='paid' AND OLD.approved_by=NEW.approved_by AND OLD.approved_at=NEW.approved_at)) THEN RAISE EXCEPTION 'Invalid payout transition'; END IF;
 SELECT coalesce(sum(l.amount_pence),0) INTO allocated FROM expansion_payout_entries e JOIN expansion_commission_ledger l ON l.id=e.ledger_id WHERE e.payout_id=OLD.id;
 IF allocated <> NEW.amount_pence THEN RAISE EXCEPTION 'Payout does not reconcile with allocated commission'; END IF;
 RETURN NEW;
END $$;
