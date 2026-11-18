CREATE TABLE "partner_applications" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL DEFAULT '',
  "region" text NOT NULL,
  "experience" text NOT NULL,
  "business_activity" text NOT NULL DEFAULT '',
  "networks" text NOT NULL DEFAULT '',
  "industries" text NOT NULL DEFAULT '',
  "motivation" text NOT NULL,
  "linkedin" text,
  "privacy_version" text NOT NULL,
  "status" text NOT NULL DEFAULT 'submitted',
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  "retention_until" timestamptz NOT NULL,
  "review_notes" text NOT NULL DEFAULT '',
  "onboarding_confirmations" jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT "partner_applications_status_check" CHECK ("status" IN ('submitted','under_review','conversation_arranged','assessment_in_progress','approved_in_principle','agreement_pending','onboarding','activated','declined','withdrawn','archived')),
  CONSTRAINT "partner_applications_retention_check" CHECK ("retention_until" > "submitted_at"),
  CONSTRAINT "partner_applications_fields_check" CHECK (length("name") BETWEEN 2 AND 120 AND length("email") BETWEEN 3 AND 254 AND length("phone") <= 40 AND length("region") BETWEEN 2 AND 120 AND length("experience") BETWEEN 10 AND 2000 AND length("motivation") BETWEEN 10 AND 2000 AND length("business_activity") <= 1000 AND length("networks") <= 1000 AND length("industries") <= 500 AND length("privacy_version") BETWEEN 1 AND 80 AND ("linkedin" IS NULL OR length("linkedin") <= 300)),
  CONSTRAINT "partner_applications_confirmations_check" CHECK (jsonb_typeof("onboarding_confirmations") = 'object')
);
--> statement-breakpoint
CREATE INDEX "partner_applications_status_submitted_idx" ON "partner_applications" ("status", "submitted_at");
--> statement-breakpoint
CREATE INDEX "partner_applications_retention_idx" ON "partner_applications" ("retention_until");
--> statement-breakpoint
CREATE INDEX "partner_applications_email_idx" ON "partner_applications" ("email");
