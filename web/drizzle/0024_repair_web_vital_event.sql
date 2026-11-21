-- Repair for schema drift found on production on 2026-11-21: the journal records 0013_web_vital_experience_event,
-- but the experience_event_name enum has no 'web_vital' label, so every Web Vitals beacon fails.
-- Idempotent: a no-op wherever 0013 took effect.
ALTER TYPE "public"."experience_event_name" ADD VALUE IF NOT EXISTS 'web_vital';
