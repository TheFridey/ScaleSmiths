-- Operation Empower B1.2 (forward-only): the Partner Academy.
-- A course is a B1.1 content item of kind 'course'. Its structure (category, objectives, ordered modules, ordered lesson
-- references) lives in the course version's `fields`, so it is versioned, reviewed, approved, published, superseded and
-- withdrawn exactly like every other item, and it is immutable from submission. This migration adds:
--   * the 'course' kind (partner-only) and a database check that course structure references real lesson items;
--   * private, append-only partner learning records: lesson completions and knowledge-check attempts, each accepted only
--     while the lesson and course are actually published, in date and linked;
--   * a per-course "continue where you left off" pointer.
-- Learning records have no relation to any commercial table. Dates are UTC.

ALTER TABLE empower_content_items DROP CONSTRAINT empower_content_items_kind_check;
ALTER TABLE empower_content_items ADD CONSTRAINT empower_content_items_kind_check CHECK (kind IN ('resource','lesson','knowledge','objection','template','course'));
ALTER TABLE empower_content_items ADD CONSTRAINT empower_content_items_course_partner_only CHECK (kind <> 'course' OR audience = 'partner_only');

-- Lesson item ids referenced by a course version, in order.
CREATE FUNCTION empower_course_lesson_ids(structure jsonb) RETURNS uuid[] LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_agg(l.value::uuid ORDER BY m.ord, l.ord), '{}')
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(structure->'modules') = 'array' THEN structure->'modules' ELSE '[]'::jsonb END) WITH ORDINALITY m(value, ord),
       jsonb_array_elements_text(CASE WHEN jsonb_typeof(m.value->'lessons') = 'array' THEN m.value->'lessons' ELSE '[]'::jsonb END) WITH ORDINALITY l(value, ord)
$$;

CREATE FUNCTION empower_course_structure_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text; ids uuid[];
BEGIN
  SELECT i.kind INTO kind FROM empower_content_items i WHERE i.id = NEW.item_id;
  IF kind <> 'course' THEN RETURN NEW; END IF;
  IF NEW.fields ? 'modules' AND jsonb_typeof(NEW.fields->'modules') <> 'array' THEN RAISE EXCEPTION 'Course modules must be a list'; END IF;
  ids := empower_course_lesson_ids(NEW.fields);
  IF cardinality(ids) <> (SELECT count(DISTINCT x) FROM unnest(ids) x) THEN RAISE EXCEPTION 'A lesson can appear only once in a course'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ids) x LEFT JOIN empower_content_items i ON i.id = x WHERE i.id IS NULL OR i.kind <> 'lesson') THEN
    RAISE EXCEPTION 'A course may reference only existing lesson items';
  END IF;
  RETURN NEW;
END $$;
-- Runs after the B1.1 lifecycle guard (trigger names sort alphabetically), so immutability is checked first.
CREATE TRIGGER empower_course_structure_guard BEFORE INSERT OR UPDATE OF fields ON empower_content_versions FOR EACH ROW EXECUTE FUNCTION empower_course_structure_guard();

-- True when the lesson version is the published, in-date version of a lesson that the published, in-date course version links.
CREATE FUNCTION empower_academy_lesson_servable(course_version uuid, lesson_version uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM empower_content_versions cv JOIN empower_content_items ci ON ci.id = cv.item_id AND ci.kind = 'course'
      JOIN empower_content_versions lv ON lv.id = lesson_version JOIN empower_content_items li ON li.id = lv.item_id AND li.kind = 'lesson'
    WHERE cv.id = course_version
      AND cv.status = 'published' AND cv.review_by >= (now() AT TIME ZONE 'UTC')::date
      AND lv.status = 'published' AND lv.review_by >= (now() AT TIME ZONE 'UTC')::date
      AND li.id = ANY (empower_course_lesson_ids(cv.fields)))
$$;

CREATE TABLE empower_academy_completions (
 id uuid PRIMARY KEY,
 partner_id uuid NOT NULL REFERENCES expansion_partners(id),
 course_version_id uuid NOT NULL REFERENCES empower_content_versions(id),
 lesson_version_id uuid NOT NULL REFERENCES empower_content_versions(id),
 completed_at timestamptz NOT NULL DEFAULT now(),
 -- A completion belongs to the exact lesson version read; it is recorded once however often "complete" is pressed.
 UNIQUE (partner_id, lesson_version_id)
);
CREATE INDEX empower_academy_completions_partner ON empower_academy_completions(partner_id, completed_at);

CREATE TABLE empower_academy_check_attempts (
 id uuid PRIMARY KEY,
 partner_id uuid NOT NULL REFERENCES expansion_partners(id),
 course_version_id uuid NOT NULL REFERENCES empower_content_versions(id),
 lesson_version_id uuid NOT NULL REFERENCES empower_content_versions(id),
 question_id text NOT NULL CHECK (question_id ~ '^q[0-9]{1,2}$'),
 answer jsonb NOT NULL CHECK (jsonb_typeof(answer) = 'array' AND jsonb_array_length(answer) BETWEEN 1 AND 6),
 correct boolean NOT NULL,
 attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX empower_academy_attempts_partner ON empower_academy_check_attempts(partner_id, lesson_version_id, attempted_at);

CREATE FUNCTION empower_academy_record_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT empower_academy_lesson_servable(NEW.course_version_id, NEW.lesson_version_id) THEN
    RAISE EXCEPTION 'This lesson is not currently available';
  END IF;
  IF TG_TABLE_NAME = 'empower_academy_completions' THEN NEW.completed_at := now(); ELSE NEW.attempted_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER empower_academy_completion_guard BEFORE INSERT ON empower_academy_completions FOR EACH ROW EXECUTE FUNCTION empower_academy_record_guard();
CREATE TRIGGER empower_academy_attempt_guard BEFORE INSERT ON empower_academy_check_attempts FOR EACH ROW EXECUTE FUNCTION empower_academy_record_guard();
CREATE TRIGGER empower_academy_completions_immutable BEFORE UPDATE OR DELETE ON empower_academy_completions FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
CREATE TRIGGER empower_academy_attempts_immutable BEFORE UPDATE OR DELETE ON empower_academy_check_attempts FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

CREATE TABLE empower_academy_course_state (
 partner_id uuid NOT NULL REFERENCES expansion_partners(id),
 course_item_id uuid NOT NULL REFERENCES empower_content_items(id),
 last_lesson_item_id uuid NOT NULL REFERENCES empower_content_items(id),
 last_viewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (partner_id, course_item_id)
);
