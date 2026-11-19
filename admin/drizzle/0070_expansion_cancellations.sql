CREATE TABLE expansion_contract_cancellations (
 contract_id uuid PRIMARY KEY REFERENCES expansion_contracts(id) ON DELETE RESTRICT,
 reason text NOT NULL, created_by uuid NOT NULL REFERENCES admin_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expansion_cancellations_immutable BEFORE UPDATE OR DELETE ON expansion_contract_cancellations FOR EACH ROW EXECUTE FUNCTION commercial_history_immutable();
--> statement-breakpoint
ALTER TABLE expansion_resources ADD CONSTRAINT expansion_resources_title_version_key UNIQUE(title,version);
CREATE FUNCTION expansion_resource_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Resource version history is retained'; END IF;
 IF OLD.id<>NEW.id OR OLD.title<>NEW.title OR OLD.category<>NEW.category OR OLD.version<>NEW.version OR OLD.audience<>NEW.audience OR OLD.content<>NEW.content OR OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at THEN RAISE EXCEPTION 'Create a new resource version to change its content'; END IF;
 IF NOT ((OLD.status='draft' AND NEW.status IN ('published','archived')) OR (OLD.status='published' AND NEW.status='archived')) THEN RAISE EXCEPTION 'Invalid resource publication transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expansion_resource_lifecycle_guard BEFORE UPDATE OR DELETE ON expansion_resources FOR EACH ROW EXECUTE FUNCTION expansion_resource_lifecycle();
