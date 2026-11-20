-- Operation Empower B1.3 (forward-only): Resource Centre search.
-- Deterministic PostgreSQL full-text search over published content only (no embeddings, no external service). The search
-- document is computed from a version's immutable title, body and fields, so it can never disagree with what is served.
-- Founders manage synonyms (for example "ssl" -> "https certificate"); a synonym is retired by switching it off, never deleted.

-- Weights: A title and the question a client would ask (plus aliases); B body, summary and answer; C category and topic.
CREATE FUNCTION empower_search_document(title text, body text, fields jsonb) RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || coalesce(fields->>'question', '') || ' ' || coalesce(fields->>'concern', '')), 'A')
      || setweight(to_tsvector('english'::regconfig, coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(fields->'aliases') = 'array' THEN fields->'aliases' ELSE '[]'::jsonb END)), '')), 'A')
      || setweight(to_tsvector('english'::regconfig, coalesce(body, '') || ' ' || coalesce(fields->>'summary', '') || ' ' || coalesce(fields->>'answer', '') || ' ' || coalesce(fields->>'client_explanation', '') || ' ' || coalesce(fields->>'client_line', '')), 'B')
      || setweight(to_tsvector('english'::regconfig, coalesce(fields->>'category', '') || ' ' || coalesce(fields->>'topic', '')), 'C')
$$;

-- Only published versions are ever searched, so only they are indexed.
CREATE INDEX empower_content_versions_search ON empower_content_versions USING gin (empower_search_document(title, body, fields)) WHERE status = 'published';

CREATE TABLE empower_search_synonyms (
 id uuid PRIMARY KEY,
 term text NOT NULL CHECK (char_length(term) BETWEEN 2 AND 60 AND term = lower(term) AND term ~ '^[a-z0-9][a-z0-9 .+-]*$'),
 expansion text NOT NULL CHECK (char_length(expansion) BETWEEN 2 AND 200 AND expansion !~ '[<>"\\]'),
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES admin_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES admin_users(id),
 updated_at timestamptz
);
CREATE UNIQUE INDEX empower_search_synonyms_term ON empower_search_synonyms(term) WHERE active;
-- Only `active` (with who and when) may change; the term and its expansion are permanent history.
CREATE FUNCTION empower_synonym_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Synonym history is retained; switch it off instead'; END IF;
  IF NEW.id <> OLD.id OR NEW.term <> OLD.term OR NEW.expansion <> OLD.expansion OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'A synonym cannot be rewritten; add a new one';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER empower_synonym_guard BEFORE UPDATE OR DELETE ON empower_search_synonyms FOR EACH ROW EXECUTE FUNCTION empower_synonym_guard();
