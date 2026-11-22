-- Operation Ascend B2.4: founder-entered forecast assumptions, versioned. Forward-only and additive.
-- Forecasts are hypothetical. This table is the only thing B2.4 writes; no financial table (payments, invoices, contracts,
-- commission ledger, payouts) is ever written by forecasting, and nothing in the finance engine reads this table.
CREATE TABLE expansion_forecast_assumptions (
 id uuid PRIMARY KEY,
 scenario text NOT NULL CHECK (scenario IN ('conservative','baseline','optimistic')),
 version integer NOT NULL CHECK (version > 0),
 qualified_bp integer NOT NULL CHECK (qualified_bp BETWEEN 0 AND 10000),
 scope_submitted_bp integer NOT NULL CHECK (scope_submitted_bp BETWEEN 0 AND 10000),
 approved_bp integer NOT NULL CHECK (approved_bp BETWEEN 0 AND 10000),
 average_value_pence bigint NOT NULL CHECK (average_value_pence BETWEEN 0 AND 999999999999),
 monthly_retention_bp integer NOT NULL CHECK (monthly_retention_bp BETWEEN 0 AND 10000),
 horizon_months integer NOT NULL CHECK (horizon_months BETWEEN 1 AND 24),
 rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 3 AND 1000),
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (scenario, version)
);
CREATE TRIGGER expansion_forecast_assumptions_immutable BEFORE UPDATE OR DELETE ON expansion_forecast_assumptions FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
