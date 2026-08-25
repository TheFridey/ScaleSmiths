#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

usage() {
  cat >&2 <<'EOF'
Usage: restore-drill-docker.sh [--dry-run]

  Proves the backup-create, validate, and restore cycle using the
  production backup scripts against disposable Docker PostgreSQL
  containers. No production data is touched.

  Produces a restore evidence file in the ops/restore-evidence/
  directory and cleans up all containers, volumes, and networks
  after completion.

  Requires: docker, bash, jq
EOF
  exit 0
}

dry_run=0
while (( $# > 0 )); do
  case "$1" in
    --dry-run) dry_run=1; shift ;;
    --help) usage ;;
    *) usage ;;
  esac
done

for cmd in docker jq; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: $cmd is required." >&2; exit 1; }
done

TIMESTAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
COMPOSE_PROJECT="ss-backup-drill-${TIMESTAMP}"
EVIDENCE_DIR="$REPO_ROOT/ops/restore-evidence"
COMPOSE_FILE="$EVIDENCE_DIR/drill-compose.${TIMESTAMP}.yml"
SOURCE_DB="scalesmiths_backup_source"
TARGET_DB="scalesmiths_restore_drill"
DB_USER="drill_user"
DB_PASS="drill_test_local_only"
SOURCE_URL="postgresql://${DB_USER}:${DB_PASS}@source-db:5432/${SOURCE_DB}"
TARGET_URL="postgresql://${DB_USER}:${DB_PASS}@target-db:5432/${TARGET_DB}"

cleanup() {
  local status=$?
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f "$COMPOSE_FILE" "$EVIDENCE_DIR/gpg-passphrase.${TIMESTAMP}"
  exit "$status"
}
trap cleanup EXIT

mkdir -p "$EVIDENCE_DIR"

cat > "$COMPOSE_FILE" <<COMPOSE
services:
  source-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${SOURCE_DB}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${SOURCE_DB}"]
      interval: 2s
      timeout: 3s
      retries: 10

  target-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${TARGET_DB}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${TARGET_DB}"]
      interval: 2s
      timeout: 3s
      retries: 10

  runner:
    image: postgres:16-alpine
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        apk add --no-cache bash jq tar gpg nodejs npm >/dev/null 2>&1

        # Seed source database with realistic ScaleSmiths tables
        psql "${SOURCE_URL}" <<'SEED'
        DROP SCHEMA IF EXISTS public CASCADE;
        DROP SCHEMA IF EXISTS drizzle CASCADE;
        CREATE SCHEMA public;
        CREATE SCHEMA drizzle;

        -- Core web-owned tables
        CREATE TABLE public.quote_requests (
          id serial PRIMARY KEY, name text NOT NULL, email text NOT NULL,
          business text, website_url text, business_type text,
          project_type text, budget text, launch_timeframe text,
          main_goal text, needs text, care_plan_interest text,
          preferred_contact_method text, enquiry_intent text DEFAULT 'quote',
          lead_source text DEFAULT 'public_quote', funnel_type text DEFAULT 'full_quote',
          phone text, consent boolean DEFAULT false,
          lead_quality text DEFAULT 'medium', email_delivery_status text DEFAULT 'pending',
          email_failure_reason text, brief text NOT NULL,
          created_at timestamptz DEFAULT now(), status text DEFAULT 'new'
        );

        CREATE TABLE public.portal_client_accounts (
          id serial PRIMARY KEY, client_id text NOT NULL,
          email text NOT NULL UNIQUE, password_hash text NOT NULL,
          active boolean DEFAULT true, created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE public.client_requests (
          id serial PRIMARY KEY, client_id text NOT NULL,
          title text NOT NULL, description text NOT NULL,
          category text DEFAULT 'general_support', priority text DEFAULT 'medium',
          status text DEFAULT 'new', affected_url text, page_url text,
          attachment_metadata jsonb, internal_notes text,
          forge_summary text, forge_suggested_actions text,
          forge_suggested_reply text,
          notification_email_status text, notification_email_failure_reason text,
          created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
          completed_at timestamptz
        );

        CREATE TABLE public.client_request_messages (
          id serial PRIMARY KEY,
          request_id integer REFERENCES public.client_requests(id) ON DELETE CASCADE,
          sender_type text NOT NULL, sender_name text NOT NULL,
          body text NOT NULL, visibility text DEFAULT 'client_visible',
          created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE public.client_timeline_events (
          id serial PRIMARY KEY, client_id text NOT NULL,
          request_id integer REFERENCES public.client_requests(id) ON DELETE CASCADE,
          project_id integer, type text NOT NULL, title text NOT NULL,
          description text NOT NULL, visibility text DEFAULT 'client_visible',
          created_by text NOT NULL, created_at timestamptz DEFAULT now()
        );

        CREATE TABLE public.monthly_reports (
          id serial PRIMARY KEY, client_id text NOT NULL,
          month integer NOT NULL, year integer NOT NULL,
          title text NOT NULL, summary text NOT NULL,
          html_content text NOT NULL,
          status text DEFAULT 'draft', generated_by text DEFAULT 'manual',
          created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
          published_at timestamptz
        );

        CREATE TABLE public.quote_rate_limits (
          key text PRIMARY KEY, count integer DEFAULT 0,
          reset_at timestamptz NOT NULL, updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE public.login_rate_limits (
          key text PRIMARY KEY, count integer DEFAULT 0,
          reset_at timestamptz NOT NULL, updated_at timestamptz DEFAULT now()
        );

        -- Core admin-owned tables
        CREATE TABLE public.admin_users (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email text NOT NULL, display_name text, password_hash text NOT NULL,
          role text NOT NULL DEFAULT 'viewer', active boolean DEFAULT true,
          mfa_enabled boolean DEFAULT false, mfa_state jsonb,
          session_version integer DEFAULT 1, last_login_at timestamptz,
          password_changed_at timestamptz, created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE public.clients (
          id serial PRIMARY KEY, name text NOT NULL, contact_name text,
          contact_email text, tier text, mrr integer DEFAULT 0,
          status text DEFAULT 'active', progress integer DEFAULT 0,
          invoice_client_code text UNIQUE, next_invoice_sequence integer DEFAULT 1,
          billing_address_line_1 text, billing_address_line_2 text,
          billing_city text, billing_county text, billing_postcode text,
          billing_country text, portal_client_id text UNIQUE
        );

        CREATE TABLE public.prospects (
          id serial PRIMARY KEY, business_name text, contact_name text,
          contact_email text, phone text, website_url text,
          source text, stage text DEFAULT 'found', priority text DEFAULT 'medium',
          estimated_project_value integer, estimated_monthly_retainer integer,
          lead_score integer, lead_score_confidence text,
          notes text, audit_summary text, audit_recommendations text,
          next_follow_up_at timestamptz, discovery_call_at timestamptz,
          proposal_sent_at timestamptz, won_at timestamptz, lost_at timestamptz,
          converted_client_id integer REFERENCES public.clients(id) ON DELETE SET NULL,
          created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE public.invoices (
          id serial PRIMARY KEY, invoice_number text UNIQUE,
          client_id integer REFERENCES public.clients(id) ON DELETE RESTRICT,
          sequence_number integer, client_code_snapshot text,
          client_name_snapshot text, billing_contact_name_snapshot text,
          billing_email_snapshot text, billing_address_line_1_snapshot text,
          billing_address_line_2_snapshot text, billing_city_snapshot text,
          billing_county_snapshot text, billing_postcode_snapshot text,
          billing_country_snapshot text, currency text DEFAULT 'GBP',
          invoice_date date NOT NULL, due_date date NOT NULL,
          status text DEFAULT 'draft', subtotal integer DEFAULT 0,
          total integer DEFAULT 0, supplier_snapshot jsonb,
          payment_snapshot jsonb, notes text,
          document_pdf bytea, document_pdf_sha256 text,
          document_template_version text, portal_published_at timestamptz,
          portal_published_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
          issued_at timestamptz, paid_at timestamptz, voided_at timestamptz,
          created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE public.invoice_items (
          id serial PRIMARY KEY,
          invoice_id integer REFERENCES public.invoices(id) ON DELETE CASCADE,
          catalogue_item_id integer, title text NOT NULL,
          description text, quantity integer NOT NULL DEFAULT 1,
          unit_amount integer NOT NULL DEFAULT 0,
          line_amount integer NOT NULL DEFAULT 0
        );

        CREATE TABLE public.invoice_delivery_attempts (
          id serial PRIMARY KEY,
          invoice_id integer REFERENCES public.invoices(id) ON DELETE RESTRICT,
          delivery_type text NOT NULL, state text DEFAULT 'pending',
          recipient text NOT NULL, subject text, operation_key text UNIQUE,
          provider_message_id text, document_sha256 text,
          sent_at timestamptz, failed_at timestamptz,
          failure_category text, failure_message text,
          initiated_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
          created_at timestamptz DEFAULT now()
        );

        -- Drizzle migration journals
        CREATE TABLE drizzle.__drizzle_web_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint NOT NULL);
        CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint NOT NULL);
        INSERT INTO drizzle.__drizzle_web_migrations(hash, created_at) VALUES ('web-migration-hash-001', 1700000000000);
        INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ('admin-migration-hash-001', 1700000001000);

        -- Realistic seed data
        INSERT INTO public.clients(name,contact_name,contact_email,tier,mrr,invoice_client_code,portal_client_id,billing_address_line_1,billing_city,billing_postcode,billing_country)
          VALUES ('Acme Ltd','John Smith','john@acme.example','Growth Partner',200000,'ACME','portal-acme','1 High Street','Leeds','LS1 1AA','United Kingdom');
        INSERT INTO public.portal_client_accounts(client_id,email,password_hash) VALUES ('portal-acme','john@acme.example','$$2a$$12$$placeholder');
        INSERT INTO public.prospects(business_name,contact_name,stage,estimated_project_value,estimated_monthly_retainer)
          VALUES ('Beta Corp','Jane Doe','contacted',1500000,300000),('Gamma Inc','Bob Wilson','proposal_sent',800000,200000);
        INSERT INTO public.admin_users(email,display_name,password_hash,role) VALUES ('owner@scalesmiths.co.uk','Owner','$$2a$$12$$placeholder','owner');
        INSERT INTO public.quote_requests(name,email,business,brief,status,email_delivery_status)
          VALUES ('Alice','alice@test.example','Test Biz','I need a website.','new','sent'),
                 ('Bob','bob@test.example','Bob Co','Looking for retainer.','new','failed');

        INSERT INTO public.client_requests(client_id,title,description,status,priority,category)
          VALUES ('portal-acme','Fix contact form','Form not submitting','new','high','form_issue');
        INSERT INTO public.monthly_reports(client_id,month,year,title,summary,html_content,status)
          VALUES ('portal-acme',8,2026,'August Report','Summary...','<p>Content</p>','published');

        SELECT 1 AS seeding_complete;
SEED

        echo "Seed complete. Source database ready."

        # Set up GPG passphrase for test encryption
        PASSPHRASE_FILE="/tmp/gpg-passphrase"
        printf 'test-drill-only-passphrase-not-a-production-secret\n' > "$PASSPHRASE_FILE"
        export GNUPGHOME="/tmp/gnupg"
        mkdir -m 700 "$GNUPGHOME"

        WORKDIR="/tmp/backup-drill"
        mkdir -p "$WORKDIR"/{source-root/web/drizzle/meta,source-root/admin/drizzle/meta,source-root/generated-sites/dummy,output,tmp,release,nginx,restore-target,evidence}
        printf 'dummy workspace\n' > "$WORKDIR/source-root/generated-sites/dummy/readme.txt"
        printf 'NODE_ENV=production\nAUTH_SECRET=test-secret-do-not-log\n' > "$WORKDIR/source-root/.env"
        printf '{"version":"7","dialect":"postgresql","entries":[]}\n' > "$WORKDIR/source-root/web/drizzle/meta/_journal.json"
        printf '{"version":"7","dialect":"postgresql","entries":[]}\n' > "$WORKDIR/source-root/admin/drizzle/meta/_journal.json"
        printf 'services: {}\n' > "$WORKDIR/source-root/docker-compose.host-nginx.yml"
        printf '{"activeReleaseId":"drill-release","previousReleaseId":"drill-prev"}\n' > "$WORKDIR/release/state.json"
        printf '{"releaseId":"drill-release","status":"active"}\n' > "$WORKDIR/release/releases/drill-release.json"
        printf 'server { server_name scalesmiths.example.test; }\n' > "$WORKDIR/nginx/scalesmiths.conf"
        printf '{"capturedAt":"2026-08-20T00:00:00Z","images":[{"image":"test","imageId":"sha256:test","repoDigests":["test@sha256:digest"]}]}\n' > "$WORKDIR/image-digests.json"

        echo "Source tree ready."

        # Step 1: Create backup
        echo "--- Step 1: Creating backup ---"
        CREATE_START=$(date +%s)
        BACKUP_ARGS=(
          BACKUP_SOURCE_ROOT="$WORKDIR/source-root"
          BACKUP_PRODUCTION_ROOT="$WORKDIR/source-root"
          BACKUP_ENV_FILE="$WORKDIR/source-root/.env"
          BACKUP_GENERATED_SITES_DIR="$WORKDIR/source-root/generated-sites"
          BACKUP_RELEASE_ROOT="$WORKDIR/release"
          BACKUP_COMPOSE_FILE="$WORKDIR/source-root/docker-compose.host-nginx.yml"
          BACKUP_NGINX_PATHS="$WORKDIR/nginx/scalesmiths.conf"
          BACKUP_OUTPUT_DIR="$WORKDIR/output"
          BACKUP_TEMP_ROOT="$WORKDIR/tmp"
          BACKUP_LOCK_FILE="$WORKDIR/backup.lock"
          BACKUP_DATABASE_URL="${SOURCE_URL}"
          BACKUP_GPG_PASSPHRASE_FILE="$PASSPHRASE_FILE"
          BACKUP_IMAGE_DIGESTS_SOURCE_FILE="$WORKDIR/image-digests.json"
          BACKUP_OPERATIONAL_KEY_OWNER="drill-operator"
          BACKUP_OPERATIONAL_KEY_ID="drill-key"
          BACKUP_RPO_HOURS=24
          BACKUP_RTO_MINUTES=60
          BACKUP_OFFSITE_REQUIRED=0
          GNUPGHOME="$GNUPGHOME"
        )

        BUNDLE=$(env "${BACKUP_ARGS[@]}" bash /scripts/backup/create-backup-bundle.sh --backup-id "drill-${TIMESTAMP}")
        CREATE_END=$(date +%s)
        CREATE_DURATION=$((CREATE_END - CREATE_START))
        echo "Backup created in ${CREATE_DURATION}s: $(basename "$BUNDLE")"

        # Step 2: Validate backup
        echo "--- Step 2: Validating backup ---"
        VALIDATE_START=$(date +%s)
        VALIDATED_ID=$(BACKUP_GPG_PASSPHRASE_FILE="$PASSPHRASE_FILE" BACKUP_TEMP_ROOT="$WORKDIR/tmp" GNUPGHOME="$GNUPGHOME" bash /scripts/backup/validate-backup-bundle.sh --bundle "$BUNDLE")
        VALIDATE_END=$(date +%s)
        VALIDATE_DURATION=$((VALIDATE_END - VALIDATE_START))
        echo "Bundle validated in ${VALIDATE_DURATION}s: $VALIDATED_ID"

        # Step 3: Prepare target database
        echo "--- Step 3: Preparing target database ---"
        psql "${TARGET_URL}" <<'PREP'
        SELECT format('COMMENT ON DATABASE %I IS %L', current_database(), 'scalesmiths-isolated-restore-target-v1') \gexec
        DROP SCHEMA IF EXISTS public CASCADE;
        DROP SCHEMA IF EXISTS drizzle CASCADE;
        CREATE SCHEMA public;
PREP
        echo "Target prepared with isolation guard."

        # Step 4: Restore
        echo "--- Step 4: Restoring into isolated target ---"
        RESTORE_START=$(date +%s)
        TARGET_HOST_PORT=$(echo "${TARGET_URL}" | sed 's|postgresql://[^@]*@||' | sed 's|/[^/]*$||')
        TARGET_HOST=$(echo "$TARGET_HOST_PORT" | cut -d: -f1)
        TARGET_DB_NAME=$(echo "${TARGET_URL}" | sed 's|.*/||')

        RESTORE_ARGS=(
          BACKUP_PRODUCTION_ROOT="$WORKDIR/source-root"
          BACKUP_TEMP_ROOT="$WORKDIR/tmp"
          BACKUP_LOCK_FILE="$WORKDIR/backup.lock"
          BACKUP_RESTORE_LOCK_FILE="$WORKDIR/restore.lock"
          GNUPGHOME="$GNUPGHOME"
        )
        # Load GPG passphrase for restore
        RESTORE_PASSPHRASE="$PASSPHRASE_FILE"

        RESTORE_EVIDENCE="$WORKDIR/evidence/restore.json"
        RESTORE_ROOT="$WORKDIR/restore-target"

        env "${RESTORE_ARGS[@]}" BACKUP_GPG_PASSPHRASE_FILE="$RESTORE_PASSPHRASE" bash /scripts/backup/restore-backup-bundle.sh \
          --bundle "$BUNDLE" \
          --target-root "$RESTORE_ROOT" \
          --database-url "${TARGET_URL}" \
          --confirm-isolated-restore \
          --confirm-target "${TARGET_HOST}/${TARGET_DB_NAME}" \
          --confirm-root "$RESTORE_ROOT" \
          --operator "docker-drill-operator" \
          --evidence "$RESTORE_EVIDENCE"

        RESTORE_END=$(date +%s)
        RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
        echo "Restore completed in ${RESTORE_DURATION}s"

        # Step 5: Verify restored data integrity
        echo "--- Step 5: Verifying restored data ---"
        echo ""
        echo "=== Table row counts ==="
        TABLES="quote_requests portal_client_accounts client_requests client_request_messages client_timeline_events monthly_reports quote_rate_limits login_rate_limits admin_users clients prospects invoices invoice_items invoice_delivery_attempts"
        for table in $TABLES; do
          COUNT=$(psql "${TARGET_URL}" -XAt -c "SELECT COUNT(*) FROM public.${table}" 2>/dev/null || echo "MISSING")
          printf "  %-35s %s\n" "$table" "$COUNT"
        done

        echo ""
        echo "=== Migration journals ==="
        psql "${TARGET_URL}" -XAt -c "SELECT COUNT(*) AS web_migrations FROM drizzle.__drizzle_web_migrations"
        psql "${TARGET_URL}" -XAt -c "SELECT COUNT(*) AS admin_migrations FROM drizzle.__drizzle_migrations"

        echo ""
        echo "=== Foreign key presence ==="
        FK_COUNT=$(psql "${TARGET_URL}" -XAt -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public'")
        printf "  Foreign key constraints: %s\n" "$FK_COUNT"

        echo ""
        echo "=== Restored files ==="
        for item in "configuration/production.env" "metadata/web-migration-journal.json" "metadata/admin-migration-journal.json" "generated-sites/dummy/readme.txt"; do
          if [ -f "$RESTORE_ROOT/$item" ]; then
            echo "  OK: $item"
          else
            echo "  MISSING: $item"
          fi
        done

        # Step 6: Verify evidence
        echo ""
        echo "=== Evidence validation ==="
        STATUS=$(jq -r '.restoreOutcome.status' "$RESTORE_EVIDENCE" 2>/dev/null || echo "MISSING")
        echo "  Restore outcome: $STATUS"
        MIG_WEB=$(jq -r '.migrationState.web | length' "$RESTORE_EVIDENCE" 2>/dev/null || echo "0")
        MIG_ADMIN=$(jq -r '.migrationState.admin | length' "$RESTORE_EVIDENCE" 2>/dev/null || echo "0")
        echo "  Web migration rows: $MIG_WEB"
        echo "  Admin migration rows: $MIG_ADMIN"
        DUR=$(jq -r '.durationSeconds' "$RESTORE_EVIDENCE" 2>/dev/null || echo "0")
        echo "  Restore duration: ${DUR}s"
        RTO=$(jq -r '.restoreOutcome.rtoMet' "$RESTORE_EVIDENCE" 2>/dev/null || echo "false")
        echo "  RTO met: $RTO"

        # Step 7: Final summary
        echo ""
        echo "=== Summary ==="
        TOTAL_DURATION=$((RESTORE_END - CREATE_START))
        echo "  Create:  ${CREATE_DURATION}s"
        echo "  Validate: ${VALIDATE_DURATION}s"
        echo "  Restore:  ${RESTORE_DURATION}s"
        echo "  Total:    ${TOTAL_DURATION}s"
        echo "  Outcome:  $STATUS"

        # Write evidence even on failure
        cp "$RESTORE_EVIDENCE" "/evidence/restore-${TIMESTAMP}.json" 2>/dev/null || true
        echo ""
        if [ "$STATUS" = "passed" ]; then
          echo "RESTORE VERIFIED"
          echo "Evidence: ops/restore-evidence/restore-${TIMESTAMP}.json"
        else
          echo "RESTORE FAILED"
          echo "Evidence: ops/restore-evidence/restore-${TIMESTAMP}.json"
          exit 1
        fi
    depends_on:
      source-db:
        condition: service_healthy
      target-db:
        condition: service_healthy
    volumes:
      - "${REPO_ROOT}/scripts/backup:/scripts/backup:ro"
      - "${EVIDENCE_DIR}:/evidence"
COMPOSE

echo "=== ScaleSmiths Backup Restore Verification ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Evidence directory: ${EVIDENCE_DIR}"
echo ""

if (( dry_run == 1 )); then
  echo "[dry-run] Would start compose project ${COMPOSE_PROJECT} with disposable databases"
  echo "[dry-run] Compose file: ${COMPOSE_FILE}"
  exit 0
fi

docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up --build --abort-on-container-exit --exit-code-from runner 2>&1 | sed '/^$/d'

EXIT_CODE=$?
if (( EXIT_CODE == 0 )); then
  echo ""
  echo "RESTORE VERIFIED"
else
  echo ""
  echo "RESTORE FAILED (exit code ${EXIT_CODE})"
fi

exit $EXIT_CODE