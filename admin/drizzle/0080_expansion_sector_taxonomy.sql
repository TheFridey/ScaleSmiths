-- Operation Intelligence checkpoint 4D: founder-defined canonical sectors (forward-only).
-- A classified prospect and a classified exclusivity compare by sector id; anything unclassified keeps the conservative free-text review path.
CREATE TABLE expansion_sectors (
 id uuid PRIMARY KEY, key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9-]{2,60}$'), label text NOT NULL,
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE expansion_sector_aliases (
 alias text PRIMARY KEY CHECK (alias = lower(alias) AND alias ~ '^[a-z0-9 ]{2,80}$'),
 sector_id uuid NOT NULL REFERENCES expansion_sectors(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE expansion_exclusivities ADD COLUMN sector_id uuid REFERENCES expansion_sectors(id) ON DELETE RESTRICT;
ALTER TABLE expansion_opportunities ADD COLUMN sector_id uuid REFERENCES expansion_sectors(id) ON DELETE RESTRICT,
  ADD COLUMN sector_classified_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT;
-- The accepted exclusivity's canonical sector is part of its immutable terms.
CREATE OR REPLACE FUNCTION expansion_exclusivity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Exclusivity history is append-only'; END IF;
  IF OLD.status = 'ended' THEN RAISE EXCEPTION 'An ended exclusivity cannot change'; END IF;
  IF NEW.id <> OLD.id OR NEW.client_id <> OLD.client_id OR NEW.sector <> OLD.sector OR NEW.area <> OLD.area OR NEW.sector_id IS DISTINCT FROM OLD.sector_id
     OR NEW.contractual_reference <> OLD.contractual_reference OR NEW.effective_from <> OLD.effective_from
     OR NEW.effective_to IS DISTINCT FROM OLD.effective_to OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Accepted exclusivity terms are immutable; supersede them with a new record';
  END IF;
  IF NEW.status <> 'ended' THEN RAISE EXCEPTION 'An active exclusivity can only be ended'; END IF;
  RETURN NEW;
END $$;
