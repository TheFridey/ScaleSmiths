-- Operation Empower B1.5: objection handling on the B1.1 governed-content model (kind 'objection' exists since 0091).
-- No new content table. This adds database protection for the invariants partners and clients rely on:
--   * an objection response is partner-only (its guidance is internal; only client_line is meant for clients);
--   * nothing reaches review, approval or publication without a valid category, the customer concern, the client-facing line,
--     the partner explanation, the limitation and a valid escalation rule;
--   * the client-facing line never carries partner-only commercial terms, whatever path wrote it;
--   * related links point only at existing resources, lessons or knowledge entries.
-- The B1.1 lifecycle, approval and two-founder rules are unchanged and still apply.

ALTER TABLE empower_content_items ADD CONSTRAINT empower_content_items_objection_partner_only CHECK (kind <> 'objection' OR audience = 'partner_only');

CREATE FUNCTION empower_objection_fields_problem(fields jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN coalesce(fields->>'category', '') NOT IN ('price','existing-supplier','competitor-comparison','website-migration','seo','ai-search','hosting','maintenance',
      'contract-length','payment-schedules','data-security','bespoke-development','delivery-times','commercial-eligibility','decision-timing','ownership','partner-independence')
      THEN 'a valid category'
    WHEN char_length(btrim(coalesce(fields->>'concern', ''))) < 2 THEN 'the customer concern'
    WHEN char_length(btrim(coalesce(fields->>'client_line', ''))) < 2 THEN 'the client-facing line'
    WHEN char_length(btrim(coalesce(fields->>'guidance', ''))) < 2 THEN 'the partner explanation'
    WHEN char_length(btrim(coalesce(fields->>'limitation', ''))) < 2 THEN 'the limitation'
    WHEN coalesce(fields->>'escalation_required', '') NOT IN ('always','when','never') THEN 'a valid escalation rule'
    WHEN fields->>'escalation_required' = 'when' AND char_length(btrim(coalesce(fields->>'escalation_condition', ''))) < 2 THEN 'the escalation condition'
    WHEN fields->>'escalation_required' <> 'never' AND coalesce(fields->>'escalation_route', '') NOT IN ('joint_sales','technical_scoping','bespoke_discovery','commercial_assistance','proposal_review','training','escalation')
      THEN 'a valid escalation route'
    WHEN fields ? 'discovery_questions' AND jsonb_typeof(fields->'discovery_questions') <> 'array' THEN 'discovery questions as a list'
    WHEN fields ? 'aliases' AND jsonb_typeof(fields->'aliases') <> 'array' THEN 'alternative phrasings as a list'
    WHEN fields ? 'related' AND jsonb_typeof(fields->'related') <> 'array' THEN 'related items as a list'
    ELSE NULL END
$$;

-- The same partner-only vocabulary the studio checks (CLIENT_BLOCKED_TERMS). Not overridable for the client-facing line.
CREATE FUNCTION empower_client_line_leaks(line text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(line, '') ~* '\m(commission|basis points|payout|withdrawal|referral reward|founder[- ]only|internal only|partner[- ]only|achievement bonus)\M'
$$;

CREATE FUNCTION empower_objection_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  item_kind text;
  problem text;
BEGIN
  SELECT i.kind INTO item_kind FROM empower_content_items i WHERE i.id = NEW.item_id;
  IF item_kind <> 'objection' THEN RETURN NEW; END IF;
  IF empower_client_line_leaks(NEW.fields->>'client_line') THEN
    RAISE EXCEPTION 'An objection client-facing line must not contain partner-only terms' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.fields ? 'related' AND jsonb_typeof(NEW.fields->'related') = 'array' AND EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(NEW.fields->'related') r(id)
       LEFT JOIN empower_content_items i ON i.id::text = r.id
       WHERE i.id IS NULL OR i.kind NOT IN ('resource','lesson','knowledge')) THEN
    RAISE EXCEPTION 'An objection may link only to existing resources, lessons or knowledge entries' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IN ('in_review','approved','published') THEN
    problem := empower_objection_fields_problem(NEW.fields);
    IF problem IS NOT NULL THEN
      RAISE EXCEPTION 'An objection response needs % before review or publication', problem USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- Sorts after the B1.1 lifecycle guard, so immutability and transition rules are checked first.
CREATE TRIGGER empower_objection_guard BEFORE INSERT OR UPDATE ON empower_content_versions FOR EACH ROW EXECUTE FUNCTION empower_objection_guard();
