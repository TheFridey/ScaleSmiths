ALTER TABLE megaton_jobs DROP CONSTRAINT megaton_jobs_kind_check;
ALTER TABLE megaton_jobs ADD CONSTRAINT megaton_jobs_kind_check CHECK (kind IN ('research','mail_sync','ai_draft','ai_search'));
--> statement-breakpoint
CREATE TABLE megaton_searches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL UNIQUE REFERENCES megaton_jobs(id),
 town text NOT NULL, industry text NOT NULL, results jsonb NOT NULL DEFAULT '[]'::jsonb,
 actor_user_id uuid NOT NULL REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE megaton_push_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES admin_users(id),
 session_version integer NOT NULL, endpoint_hash text NOT NULL UNIQUE, subscription_encrypted text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE megaton_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES admin_users(id),
 event_key text NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','accepted','unknown','failed','cancelled')),
 push_count integer NOT NULL DEFAULT 0, email_accepted boolean NOT NULL DEFAULT false,
 error_code text, started_at timestamptz, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,event_key)
);
--> statement-breakpoint
CREATE TABLE megaton_social_outreach (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), prospect_id integer NOT NULL REFERENCES prospects(id),
 channel text NOT NULL CHECK(channel IN ('linkedin','facebook','x')),
 recipient text NOT NULL, profile_url text NOT NULL, body text NOT NULL, eligibility_reference text NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 state text NOT NULL DEFAULT 'review' CHECK(state IN ('review','approved','sending','accepted','unknown','manual_completed','cancelled')),
 actor_user_id uuid NOT NULL REFERENCES admin_users(id), approved_by uuid REFERENCES admin_users(id),
 approved_session_version integer, content_hash text, due_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz, provider_reference text, started_at timestamptz, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX megaton_notifications_queue ON megaton_notifications(state,created_at);
CREATE INDEX megaton_social_due ON megaton_social_outreach(state,due_at);
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['megaton_searches','megaton_push_devices','megaton_notifications','megaton_social_outreach'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY megaton_internal ON %I USING (current_setting(''app.access_mode'',true) = ''internal_write'') WITH CHECK (current_setting(''app.access_mode'',true) = ''internal_write'')',t);
 END LOOP;
END $$;
