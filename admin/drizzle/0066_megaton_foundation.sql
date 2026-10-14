CREATE TABLE megaton_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, town text NOT NULL, industry text NOT NULL,
 country text NOT NULL DEFAULT 'GB' CHECK (country = 'GB'), actor_user_id uuid NOT NULL REFERENCES admin_users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE megaton_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), prospect_id integer NOT NULL REFERENCES prospects(id) ON DELETE RESTRICT,
 category text NOT NULL CHECK (category IN ('icp','digital','signals','commercial','contact','completeness')),
 observation text NOT NULL, source_url text NOT NULL, observed_at timestamptz NOT NULL,
 confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1), strength numeric NOT NULL CHECK (strength BETWEEN 0 AND 1),
 actor_user_id uuid NOT NULL REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE megaton_connections (
 id text PRIMARY KEY CHECK (id = 'company-mailcow'), label text NOT NULL DEFAULT 'Company Mailcow', active boolean NOT NULL DEFAULT false,
 activated_by uuid REFERENCES admin_users(id), cursor jsonb NOT NULL DEFAULT '{}'::jsonb, last_synced_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
INSERT INTO megaton_connections(id) VALUES ('company-mailcow');
--> statement-breakpoint
CREATE TABLE megaton_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), connection_id text NOT NULL REFERENCES megaton_connections(id),
 prospect_id integer REFERENCES prospects(id) ON DELETE RESTRICT, recipient text NOT NULL, subject text NOT NULL,
 status text NOT NULL DEFAULT 'review' CHECK (status IN ('review','approval','awaiting_prospect','human_active','follow_up','closed')),
 owner_user_id uuid REFERENCES admin_users(id), revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 legal_basis text, subscriber_type text CHECK (subscriber_type IN ('corporate','individual','unknown')),
 consent_reference text, suppressed boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(connection_id,recipient)
);
--> statement-breakpoint
CREATE TABLE megaton_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES megaton_conversations(id),
 external_id text NOT NULL, direction text NOT NULL CHECK (direction IN ('inbound','outbound')), body text NOT NULL,
 classification text NOT NULL, occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conversation_id,external_id)
);
--> statement-breakpoint
CREATE TABLE megaton_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES megaton_conversations(id),
 campaign_id uuid REFERENCES megaton_campaigns(id), subject text NOT NULL, body text NOT NULL,
 offer text NOT NULL CHECK (offer IN ('email','audit','website','partnership')), actor_user_id uuid NOT NULL REFERENCES admin_users(id),
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE megaton_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), draft_id uuid NOT NULL REFERENCES megaton_drafts(id),
 conversation_id uuid NOT NULL REFERENCES megaton_conversations(id), content_hash text NOT NULL,
 thread_revision integer NOT NULL, approved_by uuid NOT NULL REFERENCES admin_users(id), approved_session_version integer NOT NULL,
 expires_at timestamptz NOT NULL, due_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'approved' CHECK (state IN ('approved','sending','accepted','unknown','cancelled')),
 message_id text NOT NULL UNIQUE, provider_reference text, error_code text,
 started_at timestamptz, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX megaton_one_pending_draft ON megaton_outbox(draft_id) WHERE state IN ('approved','sending','unknown');
--> statement-breakpoint
CREATE TABLE megaton_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('research','mail_sync','ai_draft')),
 draft_id uuid REFERENCES megaton_drafts(id),
 draft_revision integer, thread_revision integer,
 prospect_id integer REFERENCES prospects(id), actor_user_id uuid NOT NULL REFERENCES admin_users(id),
 state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','completed','failed','dead_letter','cancelled')),
 attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, lease_owner uuid,
 error_code text, next_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX megaton_one_research_job ON megaton_jobs(prospect_id) WHERE kind='research' AND state IN ('queued','running');
--> statement-breakpoint
CREATE UNIQUE INDEX megaton_one_ai_draft_job ON megaton_jobs(draft_id) WHERE kind='ai_draft' AND state IN ('queued','running');
--> statement-breakpoint
CREATE UNIQUE INDEX megaton_one_mail_sync_job ON megaton_jobs(kind) WHERE kind='mail_sync' AND state IN ('queued','running');
--> statement-breakpoint
CREATE TABLE megaton_suppressions (
 address text PRIMARY KEY, reason text NOT NULL, actor_user_id uuid REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE megaton_discovery_links (
 campaign_id uuid NOT NULL REFERENCES megaton_campaigns(id), prospect_id integer NOT NULL REFERENCES prospects(id),
 source_url text NOT NULL, source_reference text NOT NULL, actor_user_id uuid NOT NULL REFERENCES admin_users(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(campaign_id,prospect_id)
);
--> statement-breakpoint
CREATE TABLE megaton_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES admin_users(id),
 entity_id text NOT NULL, action text NOT NULL, detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX megaton_outbox_due ON megaton_outbox(state,due_at);
CREATE INDEX megaton_evidence_prospect ON megaton_evidence(prospect_id);
CREATE INDEX megaton_messages_thread ON megaton_messages(conversation_id,occurred_at);
CREATE INDEX megaton_jobs_claim ON megaton_jobs(state,next_at,lease_until);
--> statement-breakpoint
CREATE TABLE megaton_ai_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL UNIQUE REFERENCES megaton_jobs(id),
 state text NOT NULL CHECK (state IN ('reserved','spent','unknown')),
 reserved_microusd integer NOT NULL CHECK (reserved_microusd >= 0), actual_microusd integer CHECK (actual_microusd >= 0),
 input_tokens integer, output_tokens integer, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE megaton_score_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), prospect_id integer NOT NULL REFERENCES prospects(id),
 model text NOT NULL, result jsonb NOT NULL, evidence_ids jsonb NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Internal admin-owned resources. Public tenant sessions receive no rows.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['megaton_campaigns','megaton_evidence','megaton_connections','megaton_conversations','megaton_messages','megaton_drafts','megaton_outbox','megaton_jobs','megaton_suppressions','megaton_discovery_links','megaton_events','megaton_ai_usage','megaton_score_runs'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY megaton_internal ON %I USING (current_setting(''app.access_mode'',true) = ''internal_write'') WITH CHECK (current_setting(''app.access_mode'',true) = ''internal_write'')',t);
 END LOOP;
END $$;
