-- Operation Ascend B2.2: a broader business-name key for partner duplicate detection. Forward-only and additive.
-- Mirrors businessNameKey in admin/src/lib/expansion.ts exactly ("&" as "and", leading "The" and trailing legal forms ignored,
-- then only a-z0-9). Registration matches on this key OR the previous plain key, so nothing that matched before stops matching.
CREATE FUNCTION expansion_business_name_key(name text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(nullif(regexp_replace(regexp_replace(k.spaced, '^\s*the\s+|(\s+(limited|ltd|plc|llp|lp|llc|inc|incorporated|cic))+\s*$', '', 'g'), '\s+', '', 'g'), ''),
                  regexp_replace(k.spaced, '\s+', '', 'g'))
  FROM (SELECT regexp_replace(replace(lower(coalesce(name, '')), '&', ' and '), '[^a-z0-9]+', ' ', 'g') AS spaced) k
$$;
-- Registration compares every CRM prospect and client name with the new key inside the admission lock; index both lookups.
CREATE INDEX prospects_business_name_key_idx ON prospects (expansion_business_name_key(business_name));
CREATE INDEX clients_business_name_key_idx ON clients (expansion_business_name_key(name));
