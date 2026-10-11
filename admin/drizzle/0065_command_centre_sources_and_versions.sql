ALTER TYPE prospect_source ADD VALUE IF NOT EXISTS 'in_person';
ALTER TYPE prospect_source ADD VALUE IF NOT EXISTS 'walk_in';
ALTER TYPE prospect_source ADD VALUE IF NOT EXISTS 'tiktok';
ALTER TYPE prospect_source ADD VALUE IF NOT EXISTS 'instagram';
ALTER TYPE prospect_source ADD VALUE IF NOT EXISTS 'cold_outreach';
ALTER TYPE prospect_source ADD VALUE IF NOT EXISTS 'networking';
ALTER TYPE prospect_source ADD VALUE IF NOT EXISTS 'existing_client';
--> statement-breakpoint
CREATE FUNCTION commercial_prospect_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.version = OLD.version THEN NEW.version := OLD.version + 1;
 ELSIF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'Invalid prospect version transition';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER commercial_prospect_version BEFORE UPDATE ON prospects FOR EACH ROW EXECUTE FUNCTION commercial_prospect_version();
