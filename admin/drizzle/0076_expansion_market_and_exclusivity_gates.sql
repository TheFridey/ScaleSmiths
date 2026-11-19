-- Operation Intelligence checkpoint 3E (gates): fail-closed market eligibility and customer sector exclusivity.
-- No market rows are seeded: until a founder approves a market explicitly (every review recorded), nothing may be accepted there.
CREATE TABLE expansion_markets (
 country_code text PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
 country_name text NOT NULL,
 status text NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review','approved','suspended')),
 plan_keys text[] NOT NULL DEFAULT '{}',
 legal_reviewed boolean NOT NULL DEFAULT false, accounting_reviewed boolean NOT NULL DEFAULT false,
 privacy_reviewed boolean NOT NULL DEFAULT false, operations_reviewed boolean NOT NULL DEFAULT false,
 approval_reference text, approved_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (status <> 'approved' OR (legal_reviewed AND accounting_reviewed AND privacy_reviewed AND operations_reviewed
        AND approval_reference IS NOT NULL AND approved_by IS NOT NULL AND cardinality(plan_keys) > 0))
);
-- The CUSTOMER's commercial market (distinct from where the partner lives). NULL = unknown = not acceptable.
ALTER TABLE expansion_opportunities ADD COLUMN customer_country text CHECK (customer_country IS NULL OR customer_country ~ '^[A-Z]{2}$');

CREATE TABLE expansion_exclusivities (
 id uuid PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 sector text NOT NULL, area text NOT NULL, contractual_reference text NOT NULL,
 effective_from date NOT NULL, effective_to date CHECK (effective_to IS NULL OR effective_to > effective_from),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 CHECK ((status = 'ended') = (ended_at IS NOT NULL))
);
CREATE TABLE expansion_exclusivity_decisions (
 id uuid PRIMARY KEY,
 opportunity_id uuid NOT NULL REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
 exclusivity_id uuid NOT NULL REFERENCES expansion_exclusivities(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK (decision IN ('cleared','exception_approved')),
 reference text NOT NULL, decided_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (opportunity_id, exclusivity_id)
);
CREATE TRIGGER expansion_exclusivity_decisions_immutable BEFORE UPDATE OR DELETE ON expansion_exclusivity_decisions FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
