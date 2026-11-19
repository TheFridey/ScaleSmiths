ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'independent_partner';
--> statement-breakpoint
CREATE TABLE expansion_partners (
 id uuid PRIMARY KEY, user_id uuid NOT NULL UNIQUE REFERENCES admin_users(id) ON DELETE RESTRICT,
 application_id integer NOT NULL UNIQUE REFERENCES partner_applications(id) ON DELETE RESTRICT,
 agreement_version text NOT NULL, confirmed_at timestamptz NOT NULL,
 invitation_hash text UNIQUE, invitation_expires_at timestamptz, activated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((invitation_hash IS NULL) = (invitation_expires_at IS NULL))
);
CREATE TABLE expansion_opportunities (
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES expansion_partners(id) ON DELETE RESTRICT,
 prospect_id integer NOT NULL UNIQUE REFERENCES prospects(id) ON DELETE RESTRICT,
 client_id integer REFERENCES clients(id) ON DELETE RESTRICT,
 normalized_domain text NOT NULL UNIQUE, company_number text UNIQUE,
 status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','contacted','discovery','qualified','scope_submitted','more_information','bespoke_required','deferred','approved','contract_accepted','closed_lost','withdrawn')),
 discovery jsonb NOT NULL DEFAULT '{}', scope jsonb NOT NULL DEFAULT '{}',
 scope_version integer NOT NULL DEFAULT 0 CHECK (scope_version>=0), review_notes text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expansion_opportunities_partner_idx ON expansion_opportunities(partner_id, created_at);
CREATE TABLE expansion_capacity (
 period date PRIMARY KEY, available_hours integer NOT NULL CHECK (available_hours BETWEEN 0 AND 10000),
 rationale text NOT NULL, configured_by uuid NOT NULL REFERENCES admin_users(id), configured_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE expansion_reservations (
 opportunity_id uuid PRIMARY KEY REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
 period date NOT NULL REFERENCES expansion_capacity(period), hours integer NOT NULL CHECK (hours>0),
 status text NOT NULL CHECK (status IN ('provisional','confirmed','released')),
 approved_by uuid NOT NULL REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expansion_reservations_period_idx ON expansion_reservations(period,status);
CREATE TABLE expansion_commission_plans (
 version text PRIMARY KEY, terms jsonb NOT NULL, created_by uuid NOT NULL REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_plans_immutable BEFORE UPDATE OR DELETE ON expansion_commission_plans FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE TABLE expansion_contracts (
 id uuid PRIMARY KEY, opportunity_id uuid NOT NULL UNIQUE REFERENCES expansion_opportunities(id) ON DELETE RESTRICT,
 client_id integer NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 commercial_contract_id integer NOT NULL UNIQUE REFERENCES commercial_contracts(id) ON DELETE RESTRICT,
 terms jsonb NOT NULL, scope_snapshot jsonb NOT NULL, scope_version integer NOT NULL CHECK(scope_version>0),
 agreement_reference text NOT NULL, accepted_at timestamptz NOT NULL,
 created_by uuid NOT NULL REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_contracts_immutable BEFORE UPDATE OR DELETE ON expansion_contracts FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE TABLE expansion_resources (
 id uuid PRIMARY KEY, title text NOT NULL, category text NOT NULL, version integer NOT NULL CHECK(version>0),
 audience text NOT NULL CHECK(audience IN ('partner','client')), content text NOT NULL,
 status text NOT NULL CHECK(status IN ('draft','published','archived')),
 created_by uuid NOT NULL REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE expansion_suppressions (
 normalized_domain text PRIMARY KEY, reason text NOT NULL, created_by uuid NOT NULL REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE expansion_audit (
 id serial PRIMARY KEY, actor_id uuid NOT NULL REFERENCES admin_users(id), entity_id text NOT NULL, action text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_audit_immutable BEFORE UPDATE OR DELETE ON expansion_audit FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
