-- Operation EMPOWER B2.10: partner self-service password recovery and applicant self-withdrawal (forward-only, additive).
-- Only SHA-256 digests of the one-time tokens are stored; the token itself exists only in the email link. Each token is single use
-- and short-lived (CHECK-enforced). Neither table grants access to anything: a reset changes one partner's own password and ends
-- their sessions; a withdrawal moves one application to 'withdrawn' through the existing transition guard. Applicant retention is
-- unchanged: a withdrawn application keeps its original retention_until and is purged only by the founder-run retention workflow.
CREATE TABLE partner_password_resets (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
 token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 CHECK (expires_at > created_at AND expires_at <= created_at + interval '1 hour'),
 CHECK (used_at IS NULL OR used_at >= created_at)
);
CREATE INDEX partner_password_resets_user_idx ON partner_password_resets (user_id, created_at);

CREATE TABLE partner_application_withdrawals (
 id uuid PRIMARY KEY,
 application_id integer NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
 token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 CHECK (expires_at > created_at AND expires_at <= created_at + interval '24 hours'),
 CHECK (used_at IS NULL OR used_at >= created_at)
);
CREATE INDEX partner_application_withdrawals_application_idx ON partner_application_withdrawals (application_id, created_at);

-- Two new partner email kinds. The constraint is replaced, never relaxed: every earlier kind remains and nothing else is allowed.
ALTER TABLE partner_notifications DROP CONSTRAINT partner_notifications_kind_check;
ALTER TABLE partner_notifications ADD CONSTRAINT partner_notifications_kind_check CHECK (kind IN ('application_received','information_requested','application_declined','invitation','activated','agreement_reissued','password_reset','withdrawal_confirmation'));
