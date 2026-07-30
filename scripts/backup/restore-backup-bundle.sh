#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/backup/backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

restore_started_at=""
restore_evidence=""
restore_operator=""
restore_target_host=""
restore_target_database=""
restore_target_root=""
restore_bundle_id="unknown"
restore_source_release="unknown"

write_failure_evidence() {
  [[ -n "$restore_started_at" ]] || return 0
  [[ -n "$restore_evidence" && ! -e "$restore_evidence" ]] || return 0
  local completed_at duration
  completed_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  duration=0
  duration=$(( $(date -u +%s) - restore_started_epoch ))
  mkdir -p "$(dirname "$restore_evidence")"
  jq -n --arg backupIdentifier "$restore_bundle_id" --arg sourceRelease "$restore_source_release" --arg startedAt "${restore_started_at:-$completed_at}" --arg completedAt "$completed_at" --argjson durationSeconds "$duration" --arg host "$restore_target_host" --arg database "$restore_target_database" --arg root "$restore_target_root" --arg operator "$restore_operator" '{formatVersion: 1, backupIdentifier: $backupIdentifier, sourceRelease: $sourceRelease, startedAt: $startedAt, completedAt: $completedAt, durationSeconds: $durationSeconds, target: {host: $host, database: $database, root: $root}, checksums: null, postgresql: null, migrationState: null, restoreOutcome: {status: "failed", category: "restore-script-failed"}, validationCommands: [], operator: $operator}' > "$restore_evidence"
  chmod 600 "$restore_evidence"
}

on_error() {
  local status=$?
  set +e
  write_failure_evidence
  backup_notify_failure "backup-restore-failed"
  exit "$status"
}
trap on_error ERR

usage() {
  cat >&2 <<'EOF'
Usage: restore-backup-bundle.sh --bundle FILE --target-root DIR
  (--database-url URL | --database-url-file FILE)
  --confirm-isolated-restore --confirm-target HOST/DATABASE
  --confirm-root ABSOLUTE_PATH [--confirm-localhost-isolated]
  --operator NAME --evidence FILE [--dry-run]
EOF
}

bundle=""
target_root=""
target_database_url=""
target_database_url_file=""
confirm_restore=0
confirm_target=""
confirm_root=""
confirm_localhost=0
dry_run=0
while (( $# > 0 )); do
  case "$1" in
    --bundle) bundle="${2:-}"; shift 2 ;;
    --target-root) target_root="${2:-}"; shift 2 ;;
    --database-url) target_database_url="${2:-}"; shift 2 ;;
    --database-url-file) target_database_url_file="${2:-}"; shift 2 ;;
    --confirm-isolated-restore) confirm_restore=1; shift ;;
    --confirm-target) confirm_target="${2:-}"; shift 2 ;;
    --confirm-root) confirm_root="${2:-}"; shift 2 ;;
    --confirm-localhost-isolated) confirm_localhost=1; shift ;;
    --operator) restore_operator="${2:-}"; shift 2 ;;
    --evidence) restore_evidence="${2:-}"; shift 2 ;;
    --dry-run) dry_run=1; BACKUP_DRY_RUN=1; shift ;;
    --help) usage; exit 0 ;;
    *) usage; backup_die "Unknown argument: $1" ;;
  esac
done

[[ -n "$bundle" && -n "$target_root" ]] || backup_die "--bundle and --target-root are required."
[[ $confirm_restore == 1 ]] || backup_die "--confirm-isolated-restore is required."
[[ -n "$restore_operator" && "$restore_operator" != *$'\r'* && "$restore_operator" != *$'\n'* && "$restore_operator" != *$'\t'* ]] || backup_die "--operator is required and must be one line."
[[ -n "$restore_evidence" ]] || backup_die "--evidence is required."
[[ ! -e "$restore_evidence" ]] || backup_die "Restore evidence path already exists."
if [[ -n "$target_database_url" && -n "$target_database_url_file" ]]; then
  backup_die "Use only one database URL input."
fi
if [[ -n "$target_database_url_file" ]]; then
  backup_assert_secret_file "$target_database_url_file" "--database-url-file"
  IFS= read -r target_database_url < "$target_database_url_file" || true
fi
[[ -n "$target_database_url" ]] || backup_die "An explicit target database URL or URL file is required."

backup_require_command node
backup_require_command jq
backup_require_command readlink
backup_require_command psql
backup_require_command pg_restore
backup_require_command tar

database_target="$(backup_parse_database_target "$target_database_url")"
IFS=$'\t' read -r restore_target_host restore_target_database <<< "$database_target"
[[ "$restore_target_database" =~ (^|[_-])(restore|drill|test|isolated)([_-]|$) ]] || backup_die "Target database name must explicitly identify a restore, drill, test, or isolated database."
[[ "$confirm_target" == "$restore_target_host/$restore_target_database" ]] || backup_die "--confirm-target must exactly repeat the parsed host/database."
if [[ "$restore_target_host" == "localhost" || "$restore_target_host" == "127.0.0.1" || "$restore_target_host" == "::1" ]]; then
  [[ $confirm_localhost == 1 ]] || backup_die "Localhost may proxy production; --confirm-localhost-isolated is required."
fi

target_parent="$(readlink -f "$(dirname "$target_root")")"
restore_target_root="$target_parent/$(basename "$target_root")"
production_root="$(readlink -f "$BACKUP_PRODUCTION_ROOT")"
[[ "$restore_target_root" != "$production_root" ]] || backup_die "Restore target must not be the production repository."
case "$restore_target_root/" in "$production_root/"*) backup_die "Restore target must not be inside the production repository." ;; esac
[[ "$restore_target_root" =~ (restore|drill|test|isolated) ]] || backup_die "Restore target path must visibly identify a restore, drill, test, or isolated destination."
[[ "$confirm_root" == "$restore_target_root" ]] || backup_die "--confirm-root must exactly repeat the canonical restore root."
if [[ -e "$restore_target_root" ]]; then
  [[ -d "$restore_target_root" && -z "$(find "$restore_target_root" -mindepth 1 -maxdepth 1 -print -quit)" ]] || backup_die "Restore root must not exist or must be empty."
fi

bundle="$(readlink -f "$bundle")"
restore_evidence_parent="$(readlink -f "$(dirname "$restore_evidence")")"
restore_evidence="$restore_evidence_parent/$(basename "$restore_evidence")"
case "$restore_evidence" in "$production_root"|"$production_root"/*) backup_die "Restore evidence must not be written into the production repository." ;; esac
case "$restore_evidence" in "$restore_target_root"|"$restore_target_root"/*) backup_die "Restore evidence must remain outside the disposable restore root." ;; esac

if (( dry_run == 1 )); then
  bash "$SCRIPT_DIR/validate-backup-bundle.sh" --bundle "$bundle" --dry-run
  backup_log "[dry-run] confirmed isolated restore target $restore_target_host/$restore_target_database"
  backup_log "[dry-run] would restore PostgreSQL and extracted files only beneath $restore_target_root"
  backup_log "[dry-run] no database connection, decryption, extraction or evidence write occurred"
  exit 0
fi

backup_require_command flock
if [[ "${BACKUP_ARCHIVE_LOCK_HELD:-0}" != "1" ]]; then
  archive_lock_file="${BACKUP_LOCK_FILE:-/run/lock/scalesmiths-backup.lock}"
  exec 7>"$archive_lock_file"
  flock --shared -n 7 || backup_die "Backup creation or pruning is currently changing recovery points."
fi
lock_file="${BACKUP_RESTORE_LOCK_FILE:-/run/lock/scalesmiths-restore.lock}"
exec 8>"$lock_file"
flock -n 8 || backup_die "Another restore operation is already running."
restore_started_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
restore_started_epoch="$(date -u +%s)"
work_dir="$(mktemp -d "${BACKUP_TEMP_ROOT:-${TMPDIR:-/tmp}}/scalesmiths-restore.XXXXXXXX")"
chmod 700 "$work_dir"
extracted="$work_dir/extracted"
cleanup() { rm -rf -- "$work_dir"; }
trap cleanup EXIT

bash "$SCRIPT_DIR/validate-backup-bundle.sh" --bundle "$bundle" --extract-to "$extracted" >/dev/null
restore_bundle_id="$(jq -r '.backupIdentifier' "$extracted/manifest.json")"
restore_source_release="$(jq -r '.sourceRelease' "$extracted/manifest.json")"
backup_prepare_pg_environment "$target_database_url" "$work_dir/postgresql"
target_pg_env=("${BACKUP_PG_ENV[@]}")

connected_database="$(env "${target_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command='SELECT current_database()')"
[[ "$connected_database" == "$restore_target_database" ]] || backup_die "Connected database does not match the confirmed restore target."
restore_guard="$(env "${target_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command="SELECT COALESCE(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = current_database()")"
[[ "$restore_guard" == "scalesmiths-isolated-restore-target-v1" ]] || backup_die "Target database is missing the required isolated-restore guard comment."

backup_log "Restoring backup $restore_bundle_id into the confirmed isolated target."
env "${target_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command='DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public' >/dev/null
env "${target_pg_env[@]}" pg_restore --dbname="$restore_target_database" --clean --if-exists --exit-on-error --no-owner --no-privileges "$extracted/data/postgres.dump"

mkdir -p "$restore_target_root"/{configuration,host-nginx,release-metadata,metadata}
install -m 600 "$extracted/configuration/production.env" "$restore_target_root/configuration/production.env"
tar --extract --gzip --file="$extracted/data/generated-sites.tar.gz" --directory="$restore_target_root" --no-same-owner --no-same-permissions
tar --extract --gzip --file="$extracted/data/host-nginx.tar.gz" --directory="$restore_target_root/host-nginx" --no-same-owner --no-same-permissions
tar --extract --gzip --file="$extracted/data/release-metadata.tar.gz" --directory="$restore_target_root/release-metadata" --no-same-owner --no-same-permissions
cp -a "$extracted/metadata/." "$restore_target_root/metadata/"
chmod -R go-rwx "$restore_target_root"

capture_target_journal() {
  local table="$1"
  local output="$2"
  local exists
  exists="$(env "${target_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command="SELECT to_regclass('drizzle.\"$table\"') IS NOT NULL")"
  if [[ "$exists" == "t" ]]; then
    env "${target_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command="SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM (SELECT id, hash, created_at::text AS created_at FROM drizzle.\"$table\" ORDER BY id) m" > "$output"
  else
    printf '[]\n' > "$output"
  fi
}
capture_target_journal "__drizzle_web_migrations" "$work_dir/target-web.json"
capture_target_journal "__drizzle_migrations" "$work_dir/target-admin.json"
jq -n --slurpfile web "$work_dir/target-web.json" --slurpfile admin "$work_dir/target-admin.json" '{web: $web[0], admin: $admin[0]}' > "$work_dir/target-migration-state.json"
expected_migration_state_sha="$(jq --sort-keys --compact-output . "$extracted/metadata/migration-state.json" | sha256sum | awk '{print $1}')"
actual_migration_state_sha="$(jq --sort-keys --compact-output . "$work_dir/target-migration-state.json" | sha256sum | awk '{print $1}')"
if [[ "$expected_migration_state_sha" != "$actual_migration_state_sha" ]]; then
  expected_web_count="$(jq '.web | length' "$extracted/metadata/migration-state.json")"
  expected_admin_count="$(jq '.admin | length' "$extracted/metadata/migration-state.json")"
  actual_web_count="$(jq '.web | length' "$work_dir/target-migration-state.json")"
  actual_admin_count="$(jq '.admin | length' "$work_dir/target-migration-state.json")"
  backup_log "Migration journal mismatch: expected sha256=$expected_migration_state_sha web=$expected_web_count admin=$expected_admin_count; restored sha256=$actual_migration_state_sha web=$actual_web_count admin=$actual_admin_count."
  backup_die "Restored migration journal state does not match the backup."
fi

env "${target_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command='SELECT 1' >/dev/null
target_postgres_version="$(env "${target_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command='SHOW server_version')"
completed_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
duration_seconds=$(( $(date -u +%s) - restore_started_epoch ))
rto_minutes="$(jq -r '.objectives.rtoMinutes' "$extracted/manifest.json")"
rto_seconds=$(( rto_minutes * 60 ))
rto_met=true
(( duration_seconds <= rto_seconds )) || rto_met=false
outcome_status="passed"
if [[ "$rto_met" != "true" && "${BACKUP_ENFORCE_RTO:-1}" == "1" ]]; then outcome_status="failed"; fi
bundle_sha="$(jq -r '.bundleSha256' "$bundle.verified.json")"
manifest_sha="$(backup_sha256_file "$extracted/manifest.json")"
source_postgres_version="$(jq -r '.postgresql.serverVersion' "$extracted/manifest.json")"

mkdir -p "$(dirname "$restore_evidence")"
jq -n --arg backupIdentifier "$restore_bundle_id" --arg sourceRelease "$restore_source_release" --arg startedAt "$restore_started_at" --arg completedAt "$completed_at" --argjson durationSeconds "$duration_seconds" --arg bundleSha256 "$bundle_sha" --arg manifestSha256 "$manifest_sha" --arg sourceVersion "$source_postgres_version" --arg targetVersion "$target_postgres_version" --slurpfile migrationState "$work_dir/target-migration-state.json" --arg host "$restore_target_host" --arg database "$restore_target_database" --arg root "$restore_target_root" --argjson rtoMinutes "$rto_minutes" --argjson rtoMet "$rto_met" --arg outcomeStatus "$outcome_status" --arg operator "$restore_operator" '{formatVersion: 1, backupIdentifier: $backupIdentifier, sourceRelease: $sourceRelease, startedAt: $startedAt, completedAt: $completedAt, durationSeconds: $durationSeconds, target: {host: $host, database: $database, root: $root}, checksums: {bundleSha256: $bundleSha256, manifestSha256: $manifestSha256}, postgresql: {sourceVersion: $sourceVersion, targetVersion: $targetVersion}, migrationState: $migrationState[0], restoreOutcome: ({status: $outcomeStatus, rtoMinutes: $rtoMinutes, rtoMet: $rtoMet} + (if $outcomeStatus == "failed" then {category: "rto-exceeded"} else {} end)), validationCommands: ["validate-backup-bundle","verify isolated database guard","reset confirmed isolated public/drizzle schemas","pg_restore --clean --if-exists --exit-on-error","SELECT current_database()","SELECT 1","compare web/admin Drizzle journal state"], operator: $operator}' > "$restore_evidence.tmp"
mv "$restore_evidence.tmp" "$restore_evidence"
chmod 600 "$restore_evidence"

backup_log "Restore $restore_bundle_id completed in ${duration_seconds}s with matching migration state."
if [[ "$outcome_status" != "passed" ]]; then
  backup_die "Restore completed but exceeded the configured RTO."
fi
printf '%s\n' "$restore_evidence"
