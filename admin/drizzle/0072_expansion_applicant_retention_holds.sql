CREATE TABLE expansion_applicant_retention_holds (
  application_id integer PRIMARY KEY REFERENCES partner_applications(id) ON DELETE RESTRICT,
  reason_code text NOT NULL CHECK (reason_code IN ('legal_review', 'privacy_request', 'commercial_dispute')),
  held_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  held_at timestamptz NOT NULL DEFAULT now()
);
