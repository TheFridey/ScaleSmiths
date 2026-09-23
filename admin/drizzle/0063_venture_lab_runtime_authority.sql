ALTER TABLE "venture_runtime_state"
ADD COLUMN "last_transition_by" uuid,
ADD COLUMN "last_transition_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "venture_runtime_state"
ADD CONSTRAINT "venture_runtime_state_last_transition_by_fk"
FOREIGN KEY ("last_transition_by") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT;
--> statement-breakpoint

INSERT INTO "venture_service_accounts" (
  "id",
  "display_name",
  "scopes",
  "active"
) VALUES (
  'venture-director',
  'Venture Director',
  ARRAY[
    'status:read',
    'opportunities:read',
    'opportunities:propose',
    'evidence:read',
    'evidence:propose',
    'experiments:read',
    'approvals:read',
    'ledger:read',
    'audit:read',
    'proposals:create'
  ]::text[],
  true
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_runtime_state"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actor_role text;
  actor_active boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab runtime state cannot be deleted';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Venture Lab runtime-state identity is immutable';
  END IF;
  IF OLD.paused IS NOT DISTINCT FROM NEW.paused THEN
    RAISE EXCEPTION 'Venture Lab runtime state may only change through an explicit STOP or resume transition';
  END IF;
  IF NEW.last_transition_by IS NULL OR NEW.last_transition_at IS NULL THEN
    RAISE EXCEPTION 'Venture Lab runtime transitions require an authenticated human identity';
  END IF;
  IF OLD.last_transition_at IS NOT NULL AND NEW.last_transition_at <= OLD.last_transition_at THEN
    RAISE EXCEPTION 'Venture Lab runtime transition timestamp must advance';
  END IF;

  SELECT role::text, active
    INTO actor_role, actor_active
    FROM admin_users
    WHERE id = NEW.last_transition_by;

  IF actor_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Venture Lab runtime transitions require an active human identity';
  END IF;

  IF OLD.paused = false AND NEW.paused = true THEN
    IF actor_role NOT IN ('owner','administrator','venture_controller','developer')
      OR NEW.paused_by IS DISTINCT FROM NEW.last_transition_by
      OR NEW.paused_at IS NULL
      OR NEW.pause_reason IS NULL
      OR length(trim(NEW.pause_reason)) = 0
    THEN
      RAISE EXCEPTION 'Venture Lab STOP requires authorised emergency-containment authority';
    END IF;
  ELSIF OLD.paused = true AND NEW.paused = false THEN
    IF actor_role NOT IN ('owner','administrator','venture_controller')
      OR NEW.paused_at IS NOT NULL
      OR NEW.paused_by IS NOT NULL
      OR NEW.pause_reason IS NOT NULL
    THEN
      RAISE EXCEPTION 'Venture Lab resume requires Venture Controller authority';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid Venture Lab runtime transition';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_runtime_state_guard"
BEFORE UPDATE OR DELETE ON "venture_runtime_state"
FOR EACH ROW EXECUTE FUNCTION "venture_guard_runtime_state"();
