-- Operation Empower B1.2 review fix (forward-only): Academy lessons must be partner-only content.
-- A client-facing lesson passes the looser client-facing review; it must never be served inside the partner Academy as if it
-- were reviewed partner guidance. Courses are already partner-only (0092). This tightens the course structure guard and the
-- servability rule used by the Academy record triggers.
CREATE OR REPLACE FUNCTION empower_course_structure_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text; ids uuid[];
BEGIN
  SELECT i.kind INTO kind FROM empower_content_items i WHERE i.id = NEW.item_id;
  IF kind <> 'course' THEN RETURN NEW; END IF;
  IF NEW.fields ? 'modules' AND jsonb_typeof(NEW.fields->'modules') <> 'array' THEN RAISE EXCEPTION 'Course modules must be a list'; END IF;
  ids := empower_course_lesson_ids(NEW.fields);
  IF cardinality(ids) <> (SELECT count(DISTINCT x) FROM unnest(ids) x) THEN RAISE EXCEPTION 'A lesson can appear only once in a course'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ids) x LEFT JOIN empower_content_items i ON i.id = x WHERE i.id IS NULL OR i.kind <> 'lesson' OR i.audience <> 'partner_only') THEN
    RAISE EXCEPTION 'A course may reference only existing partner-only lesson items';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION empower_academy_lesson_servable(course_version uuid, lesson_version uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM empower_content_versions cv JOIN empower_content_items ci ON ci.id = cv.item_id AND ci.kind = 'course'
      JOIN empower_content_versions lv ON lv.id = lesson_version JOIN empower_content_items li ON li.id = lv.item_id AND li.kind = 'lesson' AND li.audience = 'partner_only'
    WHERE cv.id = course_version
      AND cv.status = 'published' AND cv.review_by >= (now() AT TIME ZONE 'UTC')::date
      AND lv.status = 'published' AND lv.review_by >= (now() AT TIME ZONE 'UTC')::date
      AND li.id = ANY (empower_course_lesson_ids(cv.fields)))
$$;
