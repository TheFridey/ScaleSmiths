-- Operation ASCEND B2.6: one accepted commercial contract to one internal delivery project.
-- Founder-only issuance is enforced in the application; SQL constraints prevent duplicate allocation.
-- This table snapshots the accepted scope and reference; it NEVER mutates the contract or commissions.
CREATE TABLE expansion_delivery_handoffs (
  id uuid PRIMARY KEY,
  opportunity_id uuid NOT NULL UNIQUE REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
  contract_id uuid NOT NULL UNIQUE REFERENCES expansion_contracts(id) ON DELETE RESTRICT,
  client_id integer NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  delivery_project_id integer NOT NULL UNIQUE REFERENCES delivery_projects(id) ON DELETE RESTRICT,
  partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
  scope_version integer NOT NULL CHECK (scope_version > 0),
  scope_snapshot jsonb NOT NULL CHECK (jsonb_typeof(scope_snapshot) = 'object'),
  agreement_reference text NOT NULL CHECK (length(btrim(agreement_reference)) > 0),
  accepted_at timestamptz NOT NULL,
  founder_reason text NOT NULL CHECK (length(btrim(founder_reason)) BETWEEN 10 AND 1000),
  approved_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expansion_delivery_handoffs_partner_idx ON expansion_delivery_handoffs(partner_id,created_at DESC);
CREATE INDEX expansion_delivery_handoffs_client_idx ON expansion_delivery_handoffs(client_id,created_at DESC);
-- Accepted contract snapshots are immutable; changes require a separately versioned, reviewed workflow.
CREATE TRIGGER expansion_delivery_handoffs_immutable BEFORE UPDATE OR DELETE ON expansion_delivery_handoffs
  FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
