ALTER TABLE "venture_runtime_state" ADD COLUMN "care_floor_confirmed_minor" integer;
--> statement-breakpoint
ALTER TABLE "venture_runtime_state" ADD COLUMN "care_floor_confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "venture_runtime_state" ADD COLUMN "care_floor_confirmed_by" uuid;
--> statement-breakpoint
ALTER TABLE "venture_runtime_state" ADD CONSTRAINT "venture_runtime_state_care_floor_by_fk" FOREIGN KEY ("care_floor_confirmed_by") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_runtime_state" ADD CONSTRAINT "venture_runtime_state_care_floor_check" CHECK (
  ("care_floor_confirmed_minor" IS NULL AND "care_floor_confirmed_at" IS NULL AND "care_floor_confirmed_by" IS NULL)
  OR
  ("care_floor_confirmed_minor" = 45000 AND "care_floor_confirmed_at" IS NOT NULL AND "care_floor_confirmed_by" IS NOT NULL)
);
--> statement-breakpoint

CREATE TABLE "venture_validation_outcomes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experiment_id" integer NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "prospect_code" text NOT NULL,
  "business_url" text NOT NULL,
  "qualification_evidence_id" uuid NOT NULL,
  "supplier" text NOT NULL,
  "qualification_reason" text NOT NULL,
  "path" text NOT NULL,
  "ownership_awareness" text NOT NULL,
  "cancellation_belief" text NOT NULL,
  "control_matters" text NOT NULL,
  "spend_band" text NOT NULL,
  "satisfaction" text NOT NULL,
  "timing" text NOT NULL,
  "alternative_considered" text NOT NULL,
  "priced_project_acceptance" text NOT NULL,
  "care_acceptance" text NOT NULL,
  "strong_commitment" text NOT NULL,
  "outcome_status" text NOT NULL,
  "supersedes_outcome_id" uuid,
  "payload_hash" text NOT NULL,
  "captured_by_service" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_validation_outcomes_prospect_check" CHECK ("prospect_code" ~ '^P(0[1-9]|1[0-9]|20)$'),
  CONSTRAINT "venture_validation_outcomes_supplier_check" CHECK (char_length(trim("supplier")) BETWEEN 1 AND 120),
  CONSTRAINT "venture_validation_outcomes_reason_check" CHECK ("qualification_reason" IN ('site_removed','files_not_handed_over','ownership_retained','meaningful_buyout','provider_controls_domain','asset_cannot_move')),
  CONSTRAINT "venture_validation_outcomes_path_check" CHECK ("path" IN ('migration','rebuild','unknown')),
  CONSTRAINT "venture_validation_outcomes_awareness_check" CHECK ("ownership_awareness" IN ('knows','believes_other','unknown')),
  CONSTRAINT "venture_validation_outcomes_belief_check" CHECK ("cancellation_belief" IN ('site_removed','files_withheld','domain_lost','believes_they_own','unknown','other')),
  CONSTRAINT "venture_validation_outcomes_control_check" CHECK ("control_matters" IN ('yes','no','unknown')),
  CONSTRAINT "venture_validation_outcomes_spend_check" CHECK ("spend_band" IN ('under_50_pcm','50_to_99_pcm','100_to_249_pcm','250_pcm_or_more','unknown')),
  CONSTRAINT "venture_validation_outcomes_satisfaction_check" CHECK ("satisfaction" IN ('satisfied','mixed','dissatisfied','unknown')),
  CONSTRAINT "venture_validation_outcomes_timing_check" CHECK ("timing" IN ('in_minimum_term','renewal_within_90_days','rolling_or_no_known_date','not_planning_to_move','unknown')),
  CONSTRAINT "venture_validation_outcomes_alternative_check" CHECK ("alternative_considered" IN ('yes','no','unknown')),
  CONSTRAINT "venture_validation_outcomes_project_check" CHECK ("priced_project_acceptance" IN ('accepted','declined','deferred','not_offered')),
  CONSTRAINT "venture_validation_outcomes_care_check" CHECK ("care_acceptance" IN ('accepted','declined','deferred','not_offered')),
  CONSTRAINT "venture_validation_outcomes_commitment_check" CHECK ("strong_commitment" IN ('deposit_ready','written_commitment','none')),
  CONSTRAINT "venture_validation_outcomes_status_check" CHECK ("outcome_status" IN ('care_accepted','priced_next_step','no_priced_step','incomplete')),
  CONSTRAINT "venture_validation_outcomes_path_price_check" CHECK ("priced_project_acceptance" <> 'accepted' OR "path" <> 'unknown'),
  CONSTRAINT "venture_validation_outcomes_care_requires_project_check" CHECK ("care_acceptance" <> 'accepted' OR "priced_project_acceptance" = 'accepted'),
  CONSTRAINT "venture_validation_outcomes_commitment_requires_project_check" CHECK ("strong_commitment" = 'none' OR "priced_project_acceptance" = 'accepted'),
  CONSTRAINT "venture_validation_outcomes_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "venture_validation_outcomes" ADD CONSTRAINT "venture_validation_outcomes_experiment_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."venture_experiments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_validation_outcomes" ADD CONSTRAINT "venture_validation_outcomes_opportunity_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."venture_opportunities"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_validation_outcomes" ADD CONSTRAINT "venture_validation_outcomes_evidence_fk" FOREIGN KEY ("qualification_evidence_id") REFERENCES "public"."venture_evidence"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_validation_outcomes" ADD CONSTRAINT "venture_validation_outcomes_service_fk" FOREIGN KEY ("captured_by_service") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_validation_outcomes" ADD CONSTRAINT "venture_validation_outcomes_supersedes_fk" FOREIGN KEY ("supersedes_outcome_id") REFERENCES "public"."venture_validation_outcomes"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_validation_outcomes_prospect_idx" ON "venture_validation_outcomes" ("opportunity_id","prospect_code","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_validation_outcomes_supersedes_idx" ON "venture_validation_outcomes" ("supersedes_outcome_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_validation_outcomes_root_idx" ON "venture_validation_outcomes" ("opportunity_id","prospect_code") WHERE "supersedes_outcome_id" IS NULL;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_validation_outcome"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  effective_id uuid;
  prior "venture_validation_outcomes"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Venture Lab validation outcomes are append-only';
  END IF;

  IF NEW.care_acceptance = 'accepted' AND NOT EXISTS (
    SELECT 1 FROM venture_runtime_state
    WHERE id = 1 AND care_floor_confirmed_minor = 45000
  ) THEN
    RAISE EXCEPTION 'Venture Lab care floor is not confirmed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM venture_evidence
    WHERE id = NEW.qualification_evidence_id
      AND experiment_id = NEW.experiment_id
      AND opportunity_id = NEW.opportunity_id
      AND lower(evidence_type) <> 'connection-smoke'
  ) THEN
    RAISE EXCEPTION 'Qualification evidence does not support this opportunity';
  END IF;

  IF NEW.supersedes_outcome_id IS NULL THEN
    SELECT id INTO effective_id
    FROM venture_validation_outcomes
    WHERE opportunity_id = NEW.opportunity_id
      AND prospect_code = NEW.prospect_code
      AND NOT EXISTS (
        SELECT 1 FROM venture_validation_outcomes later
        WHERE later.supersedes_outcome_id = venture_validation_outcomes.id
      )
    LIMIT 1;
    IF effective_id IS NOT NULL THEN
      RAISE EXCEPTION 'An unsuperseded validation outcome already exists for this prospect';
    END IF;
  ELSE
    SELECT * INTO prior FROM venture_validation_outcomes WHERE id = NEW.supersedes_outcome_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Superseded validation outcome does not exist';
    END IF;
    IF prior.opportunity_id <> NEW.opportunity_id OR prior.prospect_code <> NEW.prospect_code THEN
      RAISE EXCEPTION 'Validation correction must stay on the same opportunity and prospect';
    END IF;
    IF EXISTS (
      SELECT 1 FROM venture_validation_outcomes WHERE supersedes_outcome_id = NEW.supersedes_outcome_id
    ) THEN
      RAISE EXCEPTION 'Validation outcome has already been superseded';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_validation_outcomes_guard"
BEFORE INSERT ON "venture_validation_outcomes"
FOR EACH ROW EXECUTE FUNCTION "venture_guard_validation_outcome"();
--> statement-breakpoint
CREATE TRIGGER "venture_validation_outcomes_append_only"
BEFORE UPDATE OR DELETE ON "venture_validation_outcomes"
FOR EACH ROW EXECUTE FUNCTION "venture_reject_history_mutation"();
