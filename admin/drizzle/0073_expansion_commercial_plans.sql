-- Operation Intelligence checkpoint 2A: forward-only commercial plan integration.
-- Collections for multi-instalment builds may be recorded against an 'interim' milestone.
ALTER TABLE expansion_payment_events DROP CONSTRAINT expansion_payment_events_milestone_check;
ALTER TABLE expansion_payment_events ADD CONSTRAINT expansion_payment_events_milestone_check
  CHECK (milestone IN ('deposit','interim','final','first_retainer'));

-- Founder-controlled availability of each approved commercial plan. Every plan starts DISABLED.
CREATE TABLE expansion_plan_settings (
  plan_key text PRIMARY KEY CHECK (plan_key IN ('standard-v2','growth-only-v1','bespoke-v1')),
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO expansion_plan_settings(plan_key) VALUES ('standard-v2'),('growth-only-v1'),('bespoke-v1');
