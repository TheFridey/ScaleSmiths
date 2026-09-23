CREATE TABLE "venture_oauth_clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" text NOT NULL,
  "client_name" text NOT NULL,
  "redirect_uris" jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_oauth_clients_client_id_unique" UNIQUE("client_id"),
  CONSTRAINT "venture_oauth_clients_name_check" CHECK (char_length("client_name") BETWEEN 1 AND 200),
  CONSTRAINT "venture_oauth_clients_redirects_check" CHECK (jsonb_typeof("redirect_uris") = 'array' AND jsonb_array_length("redirect_uris") BETWEEN 1 AND 3)
);
--> statement-breakpoint

CREATE TABLE "venture_oauth_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code_hash" text NOT NULL,
  "client_id" uuid NOT NULL,
  "redirect_uri" text NOT NULL,
  "code_challenge" text NOT NULL,
  "scope" text DEFAULT 'venture' NOT NULL,
  "resource" text NOT NULL,
  "approved_by" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_oauth_codes_code_hash_unique" UNIQUE("code_hash"),
  CONSTRAINT "venture_oauth_codes_hash_check" CHECK ("code_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "venture_oauth_codes_challenge_check" CHECK ("code_challenge" ~ '^[A-Za-z0-9_-]{43}$'),
  CONSTRAINT "venture_oauth_codes_scope_check" CHECK ("scope" = 'venture'),
  CONSTRAINT "venture_oauth_codes_expiry_check" CHECK ("expires_at" > "created_at")
);
--> statement-breakpoint
ALTER TABLE "venture_oauth_codes" ADD CONSTRAINT "venture_oauth_codes_client_fk" FOREIGN KEY ("client_id") REFERENCES "public"."venture_oauth_clients"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_oauth_codes" ADD CONSTRAINT "venture_oauth_codes_approved_by_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_oauth_codes_client_expiry_idx" ON "venture_oauth_codes" ("client_id","expires_at");
--> statement-breakpoint

CREATE TABLE "venture_oauth_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "service_account_id" text NOT NULL,
  "authorized_by" uuid NOT NULL,
  "access_token_hash" text NOT NULL,
  "refresh_token_hash" text NOT NULL,
  "scope" text DEFAULT 'venture' NOT NULL,
  "access_expires_at" timestamp with time zone NOT NULL,
  "refresh_expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "venture_oauth_tokens_access_hash_unique" UNIQUE("access_token_hash"),
  CONSTRAINT "venture_oauth_tokens_refresh_hash_unique" UNIQUE("refresh_token_hash"),
  CONSTRAINT "venture_oauth_tokens_access_hash_check" CHECK ("access_token_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "venture_oauth_tokens_refresh_hash_check" CHECK ("refresh_token_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "venture_oauth_tokens_scope_check" CHECK ("scope" = 'venture'),
  CONSTRAINT "venture_oauth_tokens_expiry_check" CHECK ("access_expires_at" > "created_at" AND "refresh_expires_at" > "access_expires_at")
);
--> statement-breakpoint
ALTER TABLE "venture_oauth_tokens" ADD CONSTRAINT "venture_oauth_tokens_client_fk" FOREIGN KEY ("client_id") REFERENCES "public"."venture_oauth_clients"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_oauth_tokens" ADD CONSTRAINT "venture_oauth_tokens_service_fk" FOREIGN KEY ("service_account_id") REFERENCES "public"."venture_service_accounts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "venture_oauth_tokens" ADD CONSTRAINT "venture_oauth_tokens_authorized_by_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "venture_oauth_tokens_access_expiry_idx" ON "venture_oauth_tokens" ("access_token_hash","access_expires_at");
--> statement-breakpoint
CREATE INDEX "venture_oauth_tokens_refresh_expiry_idx" ON "venture_oauth_tokens" ("refresh_token_hash","refresh_expires_at");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_oauth_client"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  redirect text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab OAuth clients cannot be deleted';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
    OR OLD.client_name IS DISTINCT FROM NEW.client_name
    OR OLD.redirect_uris IS DISTINCT FROM NEW.redirect_uris
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'Venture Lab OAuth client identity and redirects are immutable';
  END IF;

  IF OLD.active = false AND NEW.active = true THEN
    RAISE EXCEPTION 'Disabled Venture Lab OAuth clients cannot be reactivated';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_oauth_clients_guard" BEFORE UPDATE OR DELETE ON "venture_oauth_clients" FOR EACH ROW EXECUTE FUNCTION "venture_guard_oauth_client"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_oauth_code"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab OAuth authorization codes cannot be deleted';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.code_hash IS DISTINCT FROM NEW.code_hash
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
    OR OLD.redirect_uri IS DISTINCT FROM NEW.redirect_uri
    OR OLD.code_challenge IS DISTINCT FROM NEW.code_challenge
    OR OLD.scope IS DISTINCT FROM NEW.scope
    OR OLD.resource IS DISTINCT FROM NEW.resource
    OR OLD.approved_by IS DISTINCT FROM NEW.approved_by
    OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'Venture Lab OAuth authorization-code payload is immutable';
  END IF;

  IF OLD.consumed_at IS NOT NULL OR NEW.consumed_at IS NULL THEN
    RAISE EXCEPTION 'Venture Lab OAuth authorization codes are single-use';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_oauth_codes_guard" BEFORE UPDATE OR DELETE ON "venture_oauth_codes" FOR EACH ROW EXECUTE FUNCTION "venture_guard_oauth_code"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "venture_guard_oauth_token"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Venture Lab OAuth tokens cannot be deleted';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
    OR OLD.service_account_id IS DISTINCT FROM NEW.service_account_id
    OR OLD.authorized_by IS DISTINCT FROM NEW.authorized_by
    OR OLD.access_token_hash IS DISTINCT FROM NEW.access_token_hash
    OR OLD.refresh_token_hash IS DISTINCT FROM NEW.refresh_token_hash
    OR OLD.scope IS DISTINCT FROM NEW.scope
    OR OLD.access_expires_at IS DISTINCT FROM NEW.access_expires_at
    OR OLD.refresh_expires_at IS DISTINCT FROM NEW.refresh_expires_at
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'Venture Lab OAuth token payload is immutable';
  END IF;

  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'Revoked Venture Lab OAuth tokens cannot be reactivated';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "venture_oauth_tokens_guard" BEFORE UPDATE OR DELETE ON "venture_oauth_tokens" FOR EACH ROW EXECUTE FUNCTION "venture_guard_oauth_token"();
