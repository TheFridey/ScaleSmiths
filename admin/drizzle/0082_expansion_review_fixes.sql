-- Checkpoint 4 independent-review fixes (forward-only).
-- 1. An auto-withdrawn (rejected) reward must not block a later legitimate one: uniqueness applies to live rewards only.
DROP INDEX expansion_reward_once;
CREATE UNIQUE INDEX expansion_reward_once ON expansion_achievement_rewards(partner_id, COALESCE(programme_version, 0), milestone_clients) WHERE status <> 'rejected';
ALTER TABLE expansion_referral_rewards DROP CONSTRAINT expansion_referral_rewards_referral_id_key;
CREATE UNIQUE INDEX expansion_referral_reward_once ON expansion_referral_rewards(referral_id) WHERE status <> 'rejected';
-- 2. Milestones of an approved programme are immutable whichever version a change touches (old and new).
CREATE OR REPLACE FUNCTION expansion_milestone_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM expansion_achievement_programmes WHERE approved AND version IN (COALESCE(NEW.programme_version, OLD.programme_version), COALESCE(OLD.programme_version, NEW.programme_version))) THEN
    RAISE EXCEPTION 'Milestones of an approved programme are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
