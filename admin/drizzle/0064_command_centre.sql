ALTER TYPE prospect_stage ADD VALUE IF NOT EXISTS 'contact_identified';
ALTER TYPE prospect_stage ADD VALUE IF NOT EXISTS 'qualified';
ALTER TYPE prospect_stage ADD VALUE IF NOT EXISTS 'proposal_required';
ALTER TYPE prospect_stage ADD VALUE IF NOT EXISTS 'negotiation';
--> statement-breakpoint
ALTER TABLE prospects ADD COLUMN owner_user_id uuid REFERENCES admin_users(id) ON DELETE RESTRICT;
ALTER TABLE prospects ADD COLUMN joint boolean NOT NULL DEFAULT false;
ALTER TABLE prospects ADD COLUMN next_action text;
ALTER TABLE prospects ADD COLUMN expected_close_at timestamptz;
ALTER TABLE prospects ADD COLUMN confidence integer NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100);
ALTER TABLE prospects ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE prospects ADD COLUMN archived_at timestamptz;
CREATE INDEX prospects_owner_idx ON prospects(owner_user_id);
--> statement-breakpoint
CREATE TABLE commercial_contacts (
 id serial PRIMARY KEY, prospect_id integer NOT NULL REFERENCES prospects(id) ON DELETE RESTRICT,
 name text NOT NULL, email text, phone text, decision_maker boolean NOT NULL DEFAULT false,
 suppressed boolean NOT NULL DEFAULT false, notes text, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commercial_contacts_prospect_idx ON commercial_contacts(prospect_id);
ALTER TYPE outreach_activity_type ADD VALUE IF NOT EXISTS 'company_researched';
ALTER TYPE outreach_activity_type ADD VALUE IF NOT EXISTS 'contact_identified';
ALTER TYPE outreach_activity_type ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE outreach_activity_type ADD VALUE IF NOT EXISTS 'meeting_booked';
ALTER TYPE outreach_activity_type ADD VALUE IF NOT EXISTS 'meeting_held';
ALTER TYPE outreach_activity_type ADD VALUE IF NOT EXISTS 'contract_signed';
--> statement-breakpoint
ALTER TABLE outreach_activities ADD COLUMN contact_id integer REFERENCES commercial_contacts(id) ON DELETE RESTRICT;
ALTER TABLE outreach_activities ADD COLUMN actor_user_id uuid REFERENCES admin_users(id) ON DELETE RESTRICT;
ALTER TABLE outreach_activities ADD COLUMN next_action text;
ALTER TABLE outreach_activities ADD COLUMN request_key uuid UNIQUE;
ALTER TABLE outreach_activities ADD COLUMN occurred_at timestamptz;
CREATE INDEX outreach_activities_actor_time_idx ON outreach_activities(actor_user_id,created_at);
CREATE TABLE commercial_tasks (
 id serial PRIMARY KEY, prospect_id integer REFERENCES prospects(id) ON DELETE RESTRICT,
 contact_id integer REFERENCES commercial_contacts(id) ON DELETE RESTRICT,
 assigned_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 title text NOT NULL, notes text, priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','cancelled')),
 due_at timestamptz NOT NULL, completed_at timestamptz, recurrence_days integer CHECK (recurrence_days BETWEEN 1 AND 365),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status='completed')=(completed_at IS NOT NULL))
);
CREATE INDEX commercial_tasks_due_idx ON commercial_tasks(assigned_user_id,status,due_at);
CREATE TABLE commercial_contracts (
 id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 prospect_id integer REFERENCES prospects(id) ON DELETE RESTRICT,
 category text NOT NULL CHECK (category IN ('retainer','premium_partnership','website_build','growth_audit','performance')),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','ended')),
 monthly_amount integer NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0), one_off_amount integer NOT NULL DEFAULT 0 CHECK (one_off_amount >= 0),
 evidence text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz,
 actor_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at IS NULL OR ends_at > starts_at), CHECK (category IN ('retainer','premium_partnership') OR monthly_amount=0)
);
CREATE TABLE commercial_payments (
 id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 invoice_id integer REFERENCES invoices(id) ON DELETE RESTRICT,
 category text NOT NULL CHECK (category IN ('retainer','premium_partnership','website_build','growth_audit','performance')),
 amount integer NOT NULL CHECK (amount <> 0), evidence text NOT NULL,
 reference text NOT NULL UNIQUE, reverses_payment_id integer UNIQUE REFERENCES commercial_payments(id) ON DELETE RESTRICT,
 actor_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 received_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((amount>0 AND reverses_payment_id IS NULL) OR (amount<0 AND reverses_payment_id IS NOT NULL))
);
CREATE TABLE commercial_forecasts (
 id serial PRIMARY KEY, client_id integer NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
 amount integer NOT NULL CHECK (amount>=0), expected_at timestamptz NOT NULL, notes text NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE commercial_settings (
 key text PRIMARY KEY, value jsonb NOT NULL, version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE commercial_audit (
 id serial PRIMARY KEY, actor_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
 entity text NOT NULL, record_id text NOT NULL, action text NOT NULL, before_value jsonb, after_value jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commercial_audit_record_idx ON commercial_audit(entity,record_id,created_at);
--> statement-breakpoint
CREATE FUNCTION commercial_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Commercial history is append-only'; END $$;
CREATE TRIGGER commercial_audit_immutable BEFORE UPDATE OR DELETE ON commercial_audit FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE TRIGGER commercial_activities_immutable BEFORE UPDATE OR DELETE ON outreach_activities FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE TRIGGER commercial_payments_immutable BEFORE UPDATE OR DELETE ON commercial_payments FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
