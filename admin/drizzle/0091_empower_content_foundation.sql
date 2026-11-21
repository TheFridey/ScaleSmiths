-- Operation Empower B1.1 (forward-only): founder-controlled, versioned partner content.
-- An item is a stable identity whose audience never changes. A version is editable only while it is a draft; from
-- submission onwards it is immutable and moves only through the lifecycle below. Approval evidence is append-only.
-- Nothing here is served to partners: partner reads arrive in later phases behind their own switches.
-- Dates are UTC throughout: review dates are compared with (now() AT TIME ZONE 'UTC')::date, never the session time zone.
--
--   draft -> in_review -> approved -> published -> superseded
--     |          |-> changes_requested     |
--     |          |-> archived (rejected)    |-> archived (withdrawn, reason required)
--     |-> archived                approved -> archived
CREATE TABLE empower_content_items (
 id uuid PRIMARY KEY,
 kind text NOT NULL CHECK (kind IN ('resource','lesson','knowledge','objection','template')),
 slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 3 AND 120 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 audience text NOT NULL CHECK (audience IN ('partner_only','client_facing')),
 -- AP-GOV-06: commercial content is reviewed at least every 3 months, service content at least every 6.
 review_cadence_months smallint NOT NULL CHECK (review_cadence_months IN (3,6)),
 created_by uuid NOT NULL REFERENCES admin_users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER empower_content_items_immutable BEFORE UPDATE OR DELETE ON empower_content_items FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

CREATE TABLE empower_content_versions (
 id uuid PRIMARY KEY,
 item_id uuid NOT NULL REFERENCES empower_content_items(id),
 version integer NOT NULL CHECK (version > 0),
 title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
 body text NOT NULL CHECK (char_length(body) <= 30000),
 fields jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(fields) = 'object'),
 source_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_refs) = 'array' AND jsonb_array_length(source_refs) <= 30),
 change_summary text CHECK (change_summary IS NULL OR char_length(change_summary) <= 2000),
 lint_override_reason text CHECK (lint_override_reason IS NULL OR char_length(lint_override_reason) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','changes_requested','approved','published','superseded','archived')),
 submitted_by uuid REFERENCES admin_users(id),
 submitted_at timestamptz,
 review_by date,
 approved_at timestamptz,
 published_at timestamptz,
 superseded_at timestamptz,
 archived_at timestamptz,
 archive_reason text CHECK (archive_reason IS NULL OR char_length(archive_reason) BETWEEN 5 AND 2000),
 created_by uuid NOT NULL REFERENCES admin_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (item_id, version),
 CHECK (status IN ('draft','archived') OR (submitted_by IS NOT NULL AND submitted_at IS NOT NULL)),
 CHECK (status NOT IN ('approved','published','superseded') OR (review_by IS NOT NULL AND approved_at IS NOT NULL)),
 CHECK (status NOT IN ('published','superseded') OR published_at IS NOT NULL)
);
-- At most one published version per item, and at most one version in progress (draft, in review or approved).
CREATE UNIQUE INDEX empower_content_one_published ON empower_content_versions(item_id) WHERE status = 'published';
CREATE UNIQUE INDEX empower_content_one_open ON empower_content_versions(item_id) WHERE status IN ('draft','in_review','approved');
CREATE INDEX empower_content_versions_status ON empower_content_versions(status, review_by);

CREATE TABLE empower_content_approvals (
 id uuid PRIMARY KEY,
 version_id uuid NOT NULL REFERENCES empower_content_versions(id),
 decision text NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
 decided_by uuid NOT NULL REFERENCES admin_users(id),
 decided_at timestamptz NOT NULL DEFAULT now(),
 reference text NOT NULL CHECK (char_length(reference) BETWEEN 3 AND 200),
 notes text NOT NULL CHECK (char_length(notes) BETWEEN 5 AND 2000),
 review_by date,
 -- AP-GOV-04: an author approving their own version must record why (only permitted while a single founder is active).
 self_approval_reason text CHECK (self_approval_reason IS NULL OR char_length(self_approval_reason) BETWEEN 10 AND 2000),
 CHECK ((decision = 'approved') = (review_by IS NOT NULL)),
 CHECK (decision = 'approved' OR self_approval_reason IS NULL)
);
CREATE INDEX empower_content_approvals_version ON empower_content_approvals(version_id, decided_at);
CREATE TRIGGER empower_content_approvals_immutable BEFORE UPDATE OR DELETE ON empower_content_approvals FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();

CREATE FUNCTION empower_content_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v record;
BEGIN
  -- The decision time is the database clock, never the caller: it bounds the review window and orders decisions.
  NEW.decided_at := now();
  SELECT cv.status, cv.created_by, cv.submitted_by, ci.review_cadence_months INTO v
    FROM empower_content_versions cv JOIN empower_content_items ci ON ci.id = cv.item_id WHERE cv.id = NEW.version_id FOR UPDATE OF cv;
  IF NOT FOUND OR v.status <> 'in_review' THEN RAISE EXCEPTION 'Only a version in review can receive a decision'; END IF;
  IF NEW.decision = 'approved' THEN
    -- Both the creator and the submitter count as authors of the version.
    IF NEW.decided_by IN (v.created_by, v.submitted_by) AND NEW.self_approval_reason IS NULL THEN RAISE EXCEPTION 'An author approving their own version must record a reason'; END IF;
    IF NEW.decided_by NOT IN (v.created_by, v.submitted_by) AND NEW.self_approval_reason IS NOT NULL THEN RAISE EXCEPTION 'A self-approval reason applies only to the author'; END IF;
    IF NEW.review_by <= (NEW.decided_at AT TIME ZONE 'UTC')::date
       OR NEW.review_by > ((NEW.decided_at AT TIME ZONE 'UTC') + make_interval(months => v.review_cadence_months))::date THEN
      RAISE EXCEPTION 'The review date must be in the future and within the review cadence for this content';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER empower_content_approval_guard BEFORE INSERT ON empower_content_approvals FOR EACH ROW EXECUTE FUNCTION empower_content_approval_guard();

CREATE FUNCTION empower_content_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE decided record; moved boolean; expected text;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Content version history is retained'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.submitted_by IS NOT NULL OR NEW.submitted_at IS NOT NULL OR NEW.review_by IS NOT NULL OR NEW.approved_at IS NOT NULL
       OR NEW.published_at IS NOT NULL OR NEW.superseded_at IS NOT NULL OR NEW.archived_at IS NOT NULL OR NEW.archive_reason IS NOT NULL THEN
      RAISE EXCEPTION 'A content version starts as a draft';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id <> OLD.id OR NEW.item_id <> OLD.item_id OR NEW.version <> OLD.version OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Content version identity is immutable';
  END IF;
  IF (NEW.title, NEW.body, NEW.fields, NEW.source_refs, NEW.change_summary, NEW.lint_override_reason)
     IS DISTINCT FROM (OLD.title, OLD.body, OLD.fields, OLD.source_refs, OLD.change_summary, OLD.lint_override_reason)
     AND NOT (OLD.status = 'draft' AND NEW.status = 'draft') THEN
    RAISE EXCEPTION 'Only a draft can be edited; submitted content is immutable';
  END IF;
  moved := NEW.status IS DISTINCT FROM OLD.status;
  IF NOT moved THEN
    IF (NEW.submitted_by, NEW.submitted_at, NEW.review_by, NEW.approved_at, NEW.published_at, NEW.superseded_at, NEW.archived_at, NEW.archive_reason)
       IS DISTINCT FROM (OLD.submitted_by, OLD.submitted_at, OLD.review_by, OLD.approved_at, OLD.published_at, OLD.superseded_at, OLD.archived_at, OLD.archive_reason) THEN
      RAISE EXCEPTION 'Lifecycle evidence changes only with a lifecycle transition';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT ((OLD.status = 'draft' AND NEW.status IN ('in_review','archived'))
       OR (OLD.status = 'in_review' AND NEW.status IN ('approved','changes_requested','archived'))
       OR (OLD.status = 'approved' AND NEW.status IN ('published','archived'))
       OR (OLD.status = 'published' AND NEW.status IN ('superseded','archived'))) THEN
    RAISE EXCEPTION 'Invalid content lifecycle transition from % to %', OLD.status, NEW.status;
  END IF;
  -- Each transition owns specific evidence; every other evidence column must stay exactly as it was.
  -- Timestamps always come from the database clock, so no caller can backdate or forward-date history.
  IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by AND NEW.status <> 'in_review' THEN RAISE EXCEPTION 'Submission evidence belongs to submission'; END IF;
  IF NEW.status = 'in_review' AND NEW.submitted_by IS NULL THEN RAISE EXCEPTION 'Submission must record who submitted'; END IF;
  IF NEW.review_by IS DISTINCT FROM OLD.review_by AND NEW.status <> 'approved' THEN RAISE EXCEPTION 'Approval evidence belongs to approval'; END IF;
  IF NEW.archive_reason IS DISTINCT FROM OLD.archive_reason AND NEW.status <> 'archived' THEN RAISE EXCEPTION 'An archive reason belongs to archiving'; END IF;
  NEW.submitted_at := CASE WHEN NEW.status = 'in_review' THEN now() ELSE OLD.submitted_at END;
  NEW.approved_at := CASE WHEN NEW.status = 'approved' THEN now() ELSE OLD.approved_at END;
  NEW.published_at := CASE WHEN NEW.status = 'published' THEN now() ELSE OLD.published_at END;
  NEW.superseded_at := CASE WHEN NEW.status = 'superseded' THEN now() ELSE OLD.superseded_at END;
  NEW.archived_at := CASE WHEN NEW.status = 'archived' THEN now() ELSE OLD.archived_at END;
  IF NEW.status IN ('approved','changes_requested') OR (OLD.status = 'in_review' AND NEW.status = 'archived') THEN
    expected := CASE NEW.status WHEN 'approved' THEN 'approved' WHEN 'changes_requested' THEN 'changes_requested' ELSE 'rejected' END;
    SELECT decision, review_by INTO decided FROM empower_content_approvals WHERE version_id = NEW.id ORDER BY decided_at DESC, id DESC LIMIT 1;
    IF NOT FOUND OR decided.decision <> expected THEN
      RAISE EXCEPTION 'This transition needs a matching recorded founder decision';
    END IF;
    IF NEW.status = 'approved' AND NEW.review_by IS DISTINCT FROM decided.review_by THEN
      RAISE EXCEPTION 'Approval must carry the recorded review date';
    END IF;
  END IF;
  IF NEW.status = 'published' AND NEW.review_by < (now() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'Content past its review date cannot be published';
  END IF;
  IF NEW.status = 'archived' AND OLD.status = 'published' AND NEW.archive_reason IS NULL THEN RAISE EXCEPTION 'Withdrawing published content needs a recorded reason'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER empower_content_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON empower_content_versions FOR EACH ROW EXECUTE FUNCTION empower_content_lifecycle();
