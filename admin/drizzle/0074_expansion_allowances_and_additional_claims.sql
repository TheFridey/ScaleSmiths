-- Operation Intelligence checkpoint 2B: forward-only. Discount allowances default to NONE (no rows).
CREATE TABLE expansion_discount_policies (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 period_start date NOT NULL, period_end date NOT NULL CHECK (period_end > period_start),
 allowance_count integer NOT NULL CHECK (allowance_count BETWEEN 0 AND 50),
 permitted_fees_pence integer[] NOT NULL CHECK (cardinality(permitted_fees_pence) > 0 AND 0 <= ALL(permitted_fees_pence) AND 200000 > ALL(permitted_fees_pence)),
 approval_reference text NOT NULL, approved_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (partner_id, period_start)
);
CREATE TABLE expansion_discount_reservations (
 id uuid PRIMARY KEY, policy_id uuid NOT NULL REFERENCES expansion_discount_policies(id) ON DELETE RESTRICT,
 opportunity_id uuid NOT NULL REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
 build_fee_pence integer NOT NULL CHECK (build_fee_pence >= 0 AND build_fee_pence < 200000),
 status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','released')),
 reserved_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, reason text NOT NULL,
 contract_id uuid REFERENCES expansion_contracts(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
 CHECK ((status = 'consumed') = (contract_id IS NOT NULL))
);
CREATE UNIQUE INDEX expansion_discount_active_opportunity ON expansion_discount_reservations(opportunity_id) WHERE status IN ('reserved','consumed');
CREATE INDEX expansion_discount_policy_idx ON expansion_discount_reservations(policy_id, status);
CREATE FUNCTION expansion_discount_reservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Discount reservations are append-only'; END IF;
  IF OLD.status <> 'reserved' THEN RAISE EXCEPTION 'Resolved discount reservations are immutable'; END IF;
  IF NEW.id <> OLD.id OR NEW.policy_id <> OLD.policy_id OR NEW.opportunity_id <> OLD.opportunity_id OR NEW.build_fee_pence <> OLD.build_fee_pence OR NEW.reserved_by <> OLD.reserved_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Approved discount terms are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_discount_reservation_guard BEFORE UPDATE OR DELETE ON expansion_discount_reservations FOR EACH ROW EXECUTE FUNCTION expansion_discount_reservation_guard();

-- Existing-customer additional opportunities: a founder-reviewed claim, never an automatic duplicate bypass.
CREATE TABLE expansion_additional_claims (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 business_name text NOT NULL, normalized_domain text NOT NULL, project_label text NOT NULL, contribution text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 client_id integer REFERENCES clients(id) ON DELETE RESTRICT,
 opportunity_id uuid UNIQUE REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
 reviewed_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, review_notes text,
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 CHECK ((status = 'pending') = (reviewed_by IS NULL)),
 CHECK (status <> 'approved' OR (client_id IS NOT NULL AND opportunity_id IS NOT NULL))
);
CREATE UNIQUE INDEX expansion_additional_claim_active ON expansion_additional_claims(normalized_domain, lower(project_label)) WHERE status IN ('pending','approved');
CREATE FUNCTION expansion_additional_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status <> 'pending' THEN RAISE EXCEPTION 'Reviewed additional-business claims are immutable'; END IF;
  IF NEW.id <> OLD.id OR NEW.partner_id <> OLD.partner_id OR NEW.normalized_domain <> OLD.normalized_domain OR NEW.project_label <> OLD.project_label OR NEW.contribution <> OLD.contribution THEN
    RAISE EXCEPTION 'Submitted attribution evidence is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expansion_additional_claim_guard BEFORE UPDATE OR DELETE ON expansion_additional_claims FOR EACH ROW EXECUTE FUNCTION expansion_additional_claim_guard();
ALTER TABLE expansion_opportunities ADD COLUMN additional_claim_id uuid UNIQUE REFERENCES expansion_additional_claims(id) ON DELETE RESTRICT;
-- Ordinary registrations keep their one-domain lead protection; an approved additional project may share its customer's domain.
ALTER TABLE expansion_opportunities DROP CONSTRAINT expansion_opportunities_normalized_domain_key;
CREATE UNIQUE INDEX expansion_opportunities_domain_primary ON expansion_opportunities(normalized_domain) WHERE additional_claim_id IS NULL;
