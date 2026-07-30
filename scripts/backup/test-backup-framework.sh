#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPOSITORY_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"
diagnostics_dir="${CI_ARTIFACTS_DIR:-$REPOSITORY_ROOT/ci-artifacts}"
work_dir=""
log_file=""

redact_diagnostics() {
  sed -E \
    -e 's#(postgres(ql)?://)[^/@[:space:]]+(:[^@[:space:]]+)?@#\1[REDACTED]@#g' \
    -e 's#(([A-Za-z_]*(SECRET|PASSWORD|PASSPHRASE|TOKEN)[A-Za-z_]*|DATABASE_URL)=)[^[:space:]]+#\1[REDACTED]#Ig'
}

preserve_failure_diagnostics() {
  local status=$?
  local failed_line="${BASH_LINENO[0]:-unknown}"
  local failed_command="${BASH_COMMAND:-unknown}"
  trap - ERR
  mkdir -p "$diagnostics_dir"
  chmod 700 "$diagnostics_dir"
  {
    printf 'Backup framework failure (exit %s) at line %s\n' "$status" "$failed_line"
    printf 'Failed command: %s\n' "$failed_command"
  } | redact_diagnostics | tee "$diagnostics_dir/backup-framework-failure.txt" >&2
  if [[ -n "$log_file" && -f "$log_file" ]]; then
    redact_diagnostics < "$log_file" > "$diagnostics_dir/backup-framework-internal.redacted.log"
    printf '%s\n' '--- redacted internal backup log (last 120 lines) ---' >&2
    tail -n 120 "$diagnostics_dir/backup-framework-internal.redacted.log" >&2
  fi
  if [[ -n "$work_dir" && -d "$work_dir" ]]; then
    while IFS= read -r -d '' evidence; do
      cp -- "$evidence" "$diagnostics_dir/$(basename "$evidence")"
    done < <(find "$work_dir" -type f \( -name '*.json' -o -name '*.verified.json' \) -print0)
  fi
  return "$status"
}
trap preserve_failure_diagnostics ERR

fail() {
  printf 'TEST FAILURE: %s\n' "$*" >&2
  exit 1
}

for command in jq tar sha256sum pg_dump pg_restore psql gpg node; do
  command -v "$command" >/dev/null 2>&1 || fail "Missing test dependency: $command"
done
[[ -n "${TEST_SOURCE_DATABASE_URL:-}" && -n "${TEST_RESTORE_DATABASE_URL:-}" ]] || fail "Disposable source and restore database URLs are required."

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/scalesmiths-backup-test.XXXXXXXX")"
cleanup() {
  local status=$?
  rm -rf -- "$work_dir"
  return "$status"
}
trap cleanup EXIT

source_root="$work_dir/source-root"
output_dir="$work_dir/backups"
temp_root="$work_dir/temp"
release_root="$work_dir/release-metadata"
nginx_root="$work_dir/nginx"
restore_parent="$work_dir/isolated-restore-parent"
evidence_dir="$work_dir/evidence"
drill_base="$work_dir/restore-drill-base"
drill_evidence="$work_dir/drill-evidence"
mkdir -p "$source_root/generated-sites/client-a" "$source_root/web/drizzle/meta" "$source_root/admin/drizzle/meta" "$output_dir" "$temp_root" "$release_root/releases" "$nginx_root/includes" "$restore_parent" "$evidence_dir" "$drill_base" "$drill_evidence"

secret_value='DO_NOT_LOG_BACKUP_SECRET_9x'
printf 'NODE_ENV=production\nAUTH_SECRET=%s\nDATABASE_URL=not-used-by-test\n' "$secret_value" > "$source_root/.env"
chmod 600 "$source_root/.env"
printf 'generated workspace sentinel\n' > "$source_root/generated-sites/client-a/site.txt"
ln -s site.txt "$source_root/generated-sites/client-a/site-link.txt"
printf '{"version":"7","dialect":"postgresql","entries":[]}\n' > "$source_root/web/drizzle/meta/_journal.json"
printf '{"version":"7","dialect":"postgresql","entries":[]}\n' > "$source_root/admin/drizzle/meta/_journal.json"
printf 'services: {}\n' > "$source_root/docker-compose.host-nginx.yml"
printf '{"activeReleaseId":"release-integration-1","previousReleaseId":"release-integration-0"}\n' > "$release_root/state.json"
printf '{"releaseId":"release-integration-1","status":"active"}\n' > "$release_root/releases/release-integration-1.json"
printf 'server { server_name scalesmiths.example.test; }\n' > "$nginx_root/scalesmiths.conf"
printf 'upstream test { server 127.0.0.1:3100; }\n' > "$nginx_root/includes/upstreams.conf"
printf '{"capturedAt":"2026-07-14T00:00:00Z","images":[{"image":"test","imageId":"sha256:test","repoDigests":["test@sha256:digest"]}]}\n' > "$work_dir/image-digests.json"
gpg_passphrase='test-only-long-passphrase-not-a-production-secret'
printf '%s\n' "$gpg_passphrase" > "$work_dir/gpg-passphrase"
chmod 600 "$work_dir/gpg-passphrase"
mkdir -m 700 "$work_dir/gnupg"

psql --dbname="$TEST_SOURCE_DATABASE_URL" -X --set=ON_ERROR_STOP=1 >/dev/null <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS drizzle CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA drizzle;
CREATE TABLE public.backup_probe (id integer PRIMARY KEY, value text NOT NULL);
INSERT INTO public.backup_probe VALUES (1, 'database sentinel');
CREATE TABLE drizzle.__drizzle_web_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint NOT NULL);
CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint NOT NULL);
INSERT INTO drizzle.__drizzle_web_migrations(hash, created_at) VALUES ('web-hash', 100);
INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ('admin-hash', 200);
SQL

psql --dbname="$TEST_RESTORE_DATABASE_URL" -X --set=ON_ERROR_STOP=1 >/dev/null <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS drizzle CASCADE;
CREATE SCHEMA public;
CREATE TABLE public.must_be_removed (id integer);
SQL

common_env=(
  BACKUP_SOURCE_ROOT="$source_root"
  BACKUP_PRODUCTION_ROOT="$source_root"
  BACKUP_ENV_FILE="$source_root/.env"
  BACKUP_GENERATED_SITES_DIR="$source_root/generated-sites"
  BACKUP_RELEASE_ROOT="$release_root"
  BACKUP_COMPOSE_FILE="$source_root/docker-compose.host-nginx.yml"
  BACKUP_NGINX_PATHS="$nginx_root/scalesmiths.conf:$nginx_root/includes"
  BACKUP_OUTPUT_DIR="$output_dir"
  BACKUP_TEMP_ROOT="$temp_root"
  BACKUP_LOCK_FILE="$work_dir/backup.lock"
  BACKUP_RESTORE_LOCK_FILE="$work_dir/restore.lock"
  BACKUP_DATABASE_URL="$TEST_SOURCE_DATABASE_URL"
  BACKUP_GPG_PASSPHRASE_FILE="$work_dir/gpg-passphrase"
  BACKUP_IMAGE_DIGESTS_SOURCE_FILE="$work_dir/image-digests.json"
  BACKUP_OPERATIONAL_KEY_OWNER="integration recovery owner"
  BACKUP_OPERATIONAL_KEY_ID="integration-key"
  BACKUP_RPO_HOURS=24
  BACKUP_RTO_MINUTES=60
  BACKUP_OFFSITE_REQUIRED=0
  GNUPGHOME="$work_dir/gnupg"
)

log_file="$work_dir/backup.log"
ln -s /etc/passwd "$source_root/generated-sites/client-a/escape-link"
if env "${common_env[@]}" bash "$SCRIPT_DIR/create-backup-bundle.sh" --backup-id escaping-symlink --dry-run >/dev/null 2>&1; then
  fail "Backup accepted a generated-workspace symlink that escapes its source root."
fi
rm "$source_root/generated-sites/client-a/escape-link"
bundle="$(env "${common_env[@]}" bash "$SCRIPT_DIR/create-backup-bundle.sh" --backup-id integration-001 2>"$log_file")"
[[ -f "$bundle" && "$bundle" == *.gpg ]] || fail "Encrypted backup bundle was not created."
[[ -f "$bundle.sha256" && -f "$bundle.verified.json" ]] || fail "Checksum or verification sidecar is missing."
grep -F "$secret_value" "$log_file" >/dev/null && fail "Backup log leaked a secret."
grep -F "$gpg_passphrase" "$log_file" >/dev/null && fail "Backup log leaked the encryption passphrase."

validated_id="$(env BACKUP_GPG_PASSPHRASE_FILE="$work_dir/gpg-passphrase" BACKUP_TEMP_ROOT="$temp_root" GNUPGHOME="$work_dir/gnupg" bash "$SCRIPT_DIR/validate-backup-bundle.sh" --bundle "$bundle" 2>>"$log_file")"
[[ "$validated_id" == "integration-001" ]] || fail "Bundle validation returned the wrong identifier."

tampered="$work_dir/tampered.gpg"
cp "$bundle" "$tampered"
cp "$bundle.sha256" "$tampered.sha256"
cp "$bundle.verified.json" "$tampered.verified.json"
printf 'tamper' >> "$tampered"
if env BACKUP_GPG_PASSPHRASE_FILE="$work_dir/gpg-passphrase" BACKUP_TEMP_ROOT="$temp_root" GNUPGHOME="$work_dir/gnupg" bash "$SCRIPT_DIR/validate-backup-bundle.sh" --bundle "$tampered" >/dev/null 2>&1; then
  fail "Tampered bundle passed validation."
fi

unsafe_root="$restore_parent/production-target"
unsafe_evidence="$evidence_dir/unsafe.json"
unsafe_url="postgresql://unused:unused@127.0.0.1/scalesmiths"
if env BACKUP_PRODUCTION_ROOT="$source_root" BACKUP_GPG_PASSPHRASE_FILE="$work_dir/gpg-passphrase" BACKUP_TEMP_ROOT="$temp_root" GNUPGHOME="$work_dir/gnupg" bash "$SCRIPT_DIR/restore-backup-bundle.sh" --bundle "$bundle" --target-root "$unsafe_root" --database-url "$unsafe_url" --confirm-isolated-restore --confirm-target "127.0.0.1/scalesmiths" --confirm-root "$unsafe_root" --confirm-localhost-isolated --operator integration-operator --evidence "$unsafe_evidence" >/dev/null 2>&1; then
  fail "Restore accepted a production-like database name."
fi
[[ ! -e "$unsafe_root" && ! -e "$unsafe_evidence" ]] || fail "Rejected restore mutated its target."

restore_root="$restore_parent/isolated-restore"
restore_evidence="$evidence_dir/restore.json"
restore_target="$(BACKUP_DATABASE_URL_VALUE="$TEST_RESTORE_DATABASE_URL" node -e 'const u=new URL(process.env.BACKUP_DATABASE_URL_VALUE);process.stdout.write(u.hostname.replace(/^\[|\]$/g,"").toLowerCase()+"/"+decodeURIComponent(u.pathname.slice(1)))')"
production_root_evidence="$evidence_dir/production-root.json"
production_root_args=(
  --bundle "$bundle"
  --target-root "$source_root"
  --database-url "$TEST_RESTORE_DATABASE_URL"
  --confirm-isolated-restore
  --confirm-target "$restore_target"
  --confirm-root "$source_root"
  --operator integration-operator
  --evidence "$production_root_evidence"
)
[[ "$restore_target" == localhost/* || "$restore_target" == 127.0.0.1/* || "$restore_target" == ::1/* ]] && production_root_args+=(--confirm-localhost-isolated)
if env BACKUP_PRODUCTION_ROOT="$source_root" bash "$SCRIPT_DIR/restore-backup-bundle.sh" "${production_root_args[@]}" >/dev/null 2>&1; then
  fail "Restore accepted the production repository as its filesystem target."
fi
[[ ! -e "$production_root_evidence" ]] || fail "Production-root rejection wrote restore evidence."
unchanged_table="$(psql --dbname="$TEST_RESTORE_DATABASE_URL" -XAt --set=ON_ERROR_STOP=1 --command="SELECT to_regclass('public.must_be_removed') IS NOT NULL")"
[[ "$unchanged_table" == "t" ]] || fail "Rejected restore connected to or reset the isolated database."

dry_restore_root="$restore_parent/dry-run-restore"
dry_restore_evidence="$evidence_dir/dry-run-restore.json"
dry_restore_args=(
  --bundle "$bundle"
  --target-root "$dry_restore_root"
  --database-url "$TEST_RESTORE_DATABASE_URL"
  --confirm-isolated-restore
  --confirm-target "$restore_target"
  --confirm-root "$dry_restore_root"
  --operator integration-operator
  --evidence "$dry_restore_evidence"
  --dry-run
)
[[ "$restore_target" == localhost/* || "$restore_target" == 127.0.0.1/* || "$restore_target" == ::1/* ]] && dry_restore_args+=(--confirm-localhost-isolated)
env BACKUP_PRODUCTION_ROOT="$source_root" bash "$SCRIPT_DIR/restore-backup-bundle.sh" "${dry_restore_args[@]}" >>"$log_file" 2>&1
[[ ! -e "$dry_restore_root" && ! -e "$dry_restore_evidence" ]] || fail "Restore dry-run wrote files or evidence."
unchanged_table="$(psql --dbname="$TEST_RESTORE_DATABASE_URL" -XAt --set=ON_ERROR_STOP=1 --command="SELECT to_regclass('public.must_be_removed') IS NOT NULL")"
[[ "$unchanged_table" == "t" ]] || fail "Restore dry-run reset the database."

unguarded_root="$restore_parent/isolated-unguarded-restore"
unguarded_evidence="$evidence_dir/unguarded.json"
unguarded_args=(
  --bundle "$bundle"
  --target-root "$unguarded_root"
  --database-url "$TEST_RESTORE_DATABASE_URL"
  --confirm-isolated-restore
  --confirm-target "$restore_target"
  --confirm-root "$unguarded_root"
  --operator integration-operator
  --evidence "$unguarded_evidence"
)
[[ "$restore_target" == localhost/* || "$restore_target" == 127.0.0.1/* || "$restore_target" == ::1/* ]] && unguarded_args+=(--confirm-localhost-isolated)
if env BACKUP_PRODUCTION_ROOT="$source_root" BACKUP_GPG_PASSPHRASE_FILE="$work_dir/gpg-passphrase" BACKUP_TEMP_ROOT="$temp_root" BACKUP_LOCK_FILE="$work_dir/backup.lock" BACKUP_RESTORE_LOCK_FILE="$work_dir/restore.lock" GNUPGHOME="$work_dir/gnupg" bash "$SCRIPT_DIR/restore-backup-bundle.sh" "${unguarded_args[@]}" >/dev/null 2>>"$log_file"; then
  fail "Restore accepted a database without the isolated-restore guard."
fi
[[ ! -e "$unguarded_root" ]] || fail "Unguarded database rejection wrote restored files."
jq -e '.restoreOutcome.status == "failed"' "$unguarded_evidence" >/dev/null || fail "Unguarded database rejection did not produce safe failure evidence."
unchanged_table="$(psql --dbname="$TEST_RESTORE_DATABASE_URL" -XAt --set=ON_ERROR_STOP=1 --command="SELECT to_regclass('public.must_be_removed') IS NOT NULL")"
[[ "$unchanged_table" == "t" ]] || fail "Unguarded database rejection reset the database."
psql --dbname="$TEST_RESTORE_DATABASE_URL" -X --set=ON_ERROR_STOP=1 >/dev/null <<'SQL'
SELECT format('COMMENT ON DATABASE %I IS %L', current_database(), 'scalesmiths-isolated-restore-target-v1') \gexec
SQL

restore_args=(
  --bundle "$bundle"
  --target-root "$restore_root"
  --database-url "$TEST_RESTORE_DATABASE_URL"
  --confirm-isolated-restore
  --confirm-target "$restore_target"
  --confirm-root "$restore_root"
  --operator integration-operator
  --evidence "$restore_evidence"
)
[[ "$restore_target" == localhost/* || "$restore_target" == 127.0.0.1/* || "$restore_target" == ::1/* ]] && restore_args+=(--confirm-localhost-isolated)
env BACKUP_PRODUCTION_ROOT="$source_root" BACKUP_GPG_PASSPHRASE_FILE="$work_dir/gpg-passphrase" BACKUP_TEMP_ROOT="$temp_root" BACKUP_LOCK_FILE="$work_dir/backup.lock" BACKUP_RESTORE_LOCK_FILE="$work_dir/restore.lock" GNUPGHOME="$work_dir/gnupg" bash "$SCRIPT_DIR/restore-backup-bundle.sh" "${restore_args[@]}" >>"$log_file" 2>&1

restored_value="$(psql --dbname="$TEST_RESTORE_DATABASE_URL" -XAt --set=ON_ERROR_STOP=1 --command='SELECT value FROM public.backup_probe WHERE id=1')"
[[ "$restored_value" == "database sentinel" ]] || fail "PostgreSQL sentinel was not restored."
removed_table="$(psql --dbname="$TEST_RESTORE_DATABASE_URL" -XAt --set=ON_ERROR_STOP=1 --command="SELECT to_regclass('public.must_be_removed') IS NULL")"
[[ "$removed_table" == "t" ]] || fail "Isolated restore database was not reset before pg_restore."
[[ "$(cat "$restore_root/generated-sites/client-a/site.txt")" == "generated workspace sentinel" ]] || fail "generated-sites was not restored."
[[ -L "$restore_root/generated-sites/client-a/site-link.txt" && "$(readlink "$restore_root/generated-sites/client-a/site-link.txt")" == "site.txt" ]] || fail "Safe in-workspace symbolic link was not preserved."
[[ "$(cat "$restore_root/configuration/production.env")" == *"$secret_value"* ]] || fail "Encrypted environment configuration was not restored."
jq -e '.backupIdentifier == "integration-001" and .sourceRelease == "release-integration-1" and .restoreOutcome.status == "passed" and .operator == "integration-operator" and (.checksums.bundleSha256 | length == 64) and (.migrationState.web | length == 1) and (.migrationState.admin | length == 1)' "$restore_evidence" >/dev/null || fail "Restore evidence is incomplete."
grep -F "$secret_value" "$log_file" >/dev/null && fail "Restore log leaked a secret."
grep -F "$gpg_passphrase" "$log_file" >/dev/null && fail "Restore log leaked the encryption passphrase."

drill_args=(
  --latest-dir "$output_dir"
  --target-root-base "$drill_base"
  --confirm-root-base "$drill_base"
  --database-url "$TEST_RESTORE_DATABASE_URL"
  --confirm-target "$restore_target"
  --operator scheduled-test-operator
  --evidence-dir "$drill_evidence"
)
[[ "$restore_target" == localhost/* || "$restore_target" == 127.0.0.1/* || "$restore_target" == ::1/* ]] && drill_args+=(--confirm-localhost-isolated)
env BACKUP_PRODUCTION_ROOT="$source_root" BACKUP_GPG_PASSPHRASE_FILE="$work_dir/gpg-passphrase" BACKUP_TEMP_ROOT="$temp_root" BACKUP_LOCK_FILE="$work_dir/backup.lock" BACKUP_RESTORE_LOCK_FILE="$work_dir/restore.lock" BACKUP_DRILL_RUN_MIGRATION_VERIFIER=0 BACKUP_DRILL_RETAIN_RESTORE=0 GNUPGHOME="$work_dir/gnupg" bash "$SCRIPT_DIR/restore-drill.sh" "${drill_args[@]}" >>"$log_file" 2>&1
drill_report="$(find "$drill_evidence" -maxdepth 1 -name 'restore-drill-*.json' -print -quit)"
[[ -f "$drill_report" ]] || fail "Restore drill evidence was not created."
jq -e '.restoreOutcome.status == "passed" and .operator == "scheduled-test-operator"' "$drill_report" >/dev/null || fail "Restore drill report did not pass."
jq -e '.restoreVerifiedAt != null and (.restoreEvidence.sha256 | length == 64)' "$bundle.verified.json" >/dev/null || fail "Restore verification marker was not updated."
[[ -z "$(find "$drill_base" -mindepth 1 -maxdepth 1 -print -quit)" ]] || fail "Drill plaintext restore directory was not cleaned."

for index in 1 2 3; do
  fake_bundle="$output_dir/fake-$index.gpg"
  cp "$bundle" "$fake_bundle"
  fake_sha="$(sha256sum "$fake_bundle" | awk '{print $1}')"
  printf '%s  %s\n' "$fake_sha" "$(basename "$fake_bundle")" > "$fake_bundle.sha256"
  created="202$index-01-01T00:00:00Z"
  jq --arg id "fake-$index" --arg file "$(basename "$fake_bundle")" --arg sha "$fake_sha" --arg created "$created" '.backupIdentifier=$id | .bundleFilename=$file | .bundleSha256=$sha | .createdAt=$created | .restoreVerifiedAt=null | .restoreEvidence=null' "$bundle.verified.json" > "$fake_bundle.verified.json"
done

before_count="$(find "$output_dir" -maxdepth 1 -name '*.verified.json' | wc -l)"
env BACKUP_RETENTION_DAILY_DAYS=0 BACKUP_RETENTION_WEEKLY_WEEKS=0 BACKUP_RETENTION_MONTHLY_MONTHS=0 BACKUP_MIN_VERIFIED_RECOVERY_POINTS=2 bash "$SCRIPT_DIR/prune-backups.sh" --backup-dir "$output_dir" --dry-run >>"$log_file" 2>&1
after_dry_count="$(find "$output_dir" -maxdepth 1 -name '*.verified.json' | wc -l)"
[[ "$before_count" == "$after_dry_count" ]] || fail "Prune dry-run deleted recovery points."
env BACKUP_LOCK_FILE="$work_dir/backup.lock" BACKUP_RETENTION_DAILY_DAYS=0 BACKUP_RETENTION_WEEKLY_WEEKS=0 BACKUP_RETENTION_MONTHLY_MONTHS=0 BACKUP_MIN_VERIFIED_RECOVERY_POINTS=2 bash "$SCRIPT_DIR/prune-backups.sh" --backup-dir "$output_dir" >>"$log_file" 2>&1
after_prune_count="$(find "$output_dir" -maxdepth 1 -name '*.verified.json' | wc -l)"
[[ "$after_prune_count" == "2" ]] || fail "Retention did not preserve exactly the two newest verified points in the fixture."
[[ -f "$bundle" && -f "$bundle.verified.json" ]] || fail "Newest restore-verified recovery point was deleted."

dry_before="$(find "$output_dir" -maxdepth 1 -type f | wc -l)"
if env "${common_env[@]}" BACKUP_AGE_RECIPIENT=age1deliberately_invalid_test_recipient bash "$SCRIPT_DIR/create-backup-bundle.sh" --backup-id conflicting-encryption --dry-run >/dev/null 2>&1; then
  fail "Backup accepted conflicting encryption modes."
fi
env "${common_env[@]}" bash "$SCRIPT_DIR/create-backup-bundle.sh" --backup-id dry-run-check --dry-run >>"$log_file" 2>&1
dry_after="$(find "$output_dir" -maxdepth 1 -type f | wc -l)"
[[ "$dry_before" == "$dry_after" ]] || fail "Backup creation dry-run wrote files."
grep -F "$secret_value" "$log_file" >/dev/null && fail "Framework log leaked a secret."

printf 'Backup framework integration test passed.\n'
