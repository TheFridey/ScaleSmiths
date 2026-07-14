#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/backup/backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

on_error() {
  local status=$?
  backup_notify_failure "backup-restore-drill-failed"
  exit "$status"
}
trap on_error ERR

usage() {
  cat >&2 <<'EOF'
Usage: restore-drill.sh (--bundle FILE | --latest-dir DIR)
  --target-root-base DIR --confirm-root-base DIR
  (--database-url URL | --database-url-file FILE)
  --confirm-target HOST/DATABASE [--confirm-localhost-isolated]
  --operator NAME --evidence-dir DIR [--dry-run]
EOF
}

bundle=""
latest_dir=""
target_root_base=""
confirm_root_base=""
database_url=""
database_url_file=""
confirm_target=""
confirm_localhost=0
operator=""
evidence_dir=""
dry_run=0
while (( $# > 0 )); do
  case "$1" in
    --bundle) bundle="${2:-}"; shift 2 ;;
    --latest-dir) latest_dir="${2:-}"; shift 2 ;;
    --target-root-base) target_root_base="${2:-}"; shift 2 ;;
    --confirm-root-base) confirm_root_base="${2:-}"; shift 2 ;;
    --database-url) database_url="${2:-}"; shift 2 ;;
    --database-url-file) database_url_file="${2:-}"; shift 2 ;;
    --confirm-target) confirm_target="${2:-}"; shift 2 ;;
    --confirm-localhost-isolated) confirm_localhost=1; shift ;;
    --operator) operator="${2:-}"; shift 2 ;;
    --evidence-dir) evidence_dir="${2:-}"; shift 2 ;;
    --dry-run) dry_run=1; BACKUP_DRY_RUN=1; shift ;;
    --help) usage; exit 0 ;;
    *) usage; backup_die "Unknown argument: $1" ;;
  esac
done

backup_require_command jq
backup_require_command readlink
backup_require_command sha256sum
[[ -n "$bundle" || -n "$latest_dir" ]] || backup_die "Use --bundle or --latest-dir."
[[ -z "$bundle" || -z "$latest_dir" ]] || backup_die "Use only one bundle selector."
[[ -n "$target_root_base" && -n "$confirm_root_base" ]] || backup_die "Restore drill root and confirmation are required."
[[ -n "$confirm_target" && -n "$operator" && -n "$evidence_dir" ]] || backup_die "Target confirmation, operator and evidence directory are required."

if (( dry_run == 0 )); then
  backup_require_command flock
  archive_lock_file="${BACKUP_LOCK_FILE:-/run/lock/scalesmiths-backup.lock}"
  exec 9>"$archive_lock_file"
  flock --shared -n 9 || backup_die "Backup creation or pruning is currently changing recovery points."
  export BACKUP_ARCHIVE_LOCK_HELD=1
fi

if [[ -n "$latest_dir" ]]; then
  latest_dir="$(readlink -f "$latest_dir")"
  [[ -d "$latest_dir" ]] || backup_die "Latest-bundle directory does not exist."
  newest_created=""
  newest_marker=""
  shopt -s nullglob
  for marker in "$latest_dir"/*.verified.json; do
    jq -e '.integrityVerified == true and (.createdAt | type == "string") and (.bundleFilename | type == "string")' "$marker" >/dev/null || continue
    created="$(jq -r '.createdAt' "$marker")"
    if [[ -z "$newest_created" || "$created" > "$newest_created" ]]; then
      newest_created="$created"
      newest_marker="$marker"
    fi
  done
  shopt -u nullglob
  [[ -n "$newest_marker" ]] || backup_die "No integrity-verified backup marker was found."
  bundle="$(dirname "$newest_marker")/$(jq -r '.bundleFilename' "$newest_marker")"
fi

bundle="$(readlink -f "$bundle")"
[[ -f "$bundle" ]] || backup_die "Selected drill bundle is missing."
marker_file="$bundle.verified.json"
[[ -f "$marker_file" ]] || backup_die "Selected drill bundle has no verification marker."
bundle_id="$(jq -r '.backupIdentifier' "$marker_file")"
[[ "$bundle_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$ ]] || backup_die "Backup marker contains an invalid identifier."

root_parent="$(readlink -f "$(dirname "$target_root_base")")"
target_root_base="$root_parent/$(basename "$target_root_base")"
[[ "$target_root_base" == "$confirm_root_base" ]] || backup_die "--confirm-root-base must exactly repeat the canonical drill root."
[[ "$target_root_base" =~ (restore|drill|test|isolated) ]] || backup_die "Drill root must visibly identify an isolated restore destination."
evidence_parent="$(readlink -f "$(dirname "$evidence_dir")")"
evidence_dir="$evidence_parent/$(basename "$evidence_dir")"

run_stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
target_root="$target_root_base/$bundle_id-$run_stamp"
evidence="$evidence_dir/restore-drill-$bundle_id-$run_stamp.json"
(( dry_run == 1 )) || {
  mkdir -p "$target_root_base" "$evidence_dir"
  chmod 700 "$target_root_base" "$evidence_dir"
}

restore_args=(
  --bundle "$bundle"
  --target-root "$target_root"
  --confirm-isolated-restore
  --confirm-target "$confirm_target"
  --confirm-root "$target_root"
  --operator "$operator"
  --evidence "$evidence"
)
if [[ -n "$database_url_file" ]]; then
  restore_args+=(--database-url-file "$database_url_file")
elif [[ -n "$database_url" ]]; then
  restore_args+=(--database-url "$database_url")
else
  backup_die "An explicit drill database URL or URL file is required."
fi
(( confirm_localhost == 1 )) && restore_args+=(--confirm-localhost-isolated)
(( dry_run == 1 )) && restore_args+=(--dry-run)

bash "$SCRIPT_DIR/restore-backup-bundle.sh" "${restore_args[@]}" >/dev/null
if (( dry_run == 1 )); then
  backup_log "[dry-run] restore drill would validate RTO, migration compatibility and update the verified marker"
  exit 0
fi

if [[ "${BACKUP_DRILL_RUN_MIGRATION_VERIFIER:-1}" == "1" ]]; then
  migration_report="$evidence.migrations.json"
  verifier_args=(
    "$BACKUP_PRODUCTION_ROOT/scripts/verify-production-backup-migrations.mjs"
    --confirm-isolated-backup
    --confirm-target "$confirm_target"
    --report "$migration_report"
  )
  if [[ -n "$database_url_file" ]]; then
    verifier_args+=(--database-url-file "$database_url_file")
  else
    verifier_args+=(--database-url "$database_url")
  fi
  (( confirm_localhost == 1 )) && verifier_args+=(--confirm-localhost-isolated)
  node "${verifier_args[@]}"
  jq -e '.status == "passed"' "$migration_report" >/dev/null
  migration_report_sha="$(backup_sha256_file "$migration_report")"
  jq --arg migrationReport "$(basename "$migration_report")" --arg migrationReportSha256 "$migration_report_sha" '.restoreOutcome.migrationVerification = {report: $migrationReport, sha256: $migrationReportSha256}' "$evidence" > "$evidence.tmp"
  mv "$evidence.tmp" "$evidence"
fi

completed_at="$(jq -r '.completedAt' "$evidence")"
evidence_sha="$(backup_sha256_file "$evidence")"
jq --arg completedAt "$completed_at" --arg evidenceFile "$(basename "$evidence")" --arg evidenceSha256 "$evidence_sha" '.restoreVerifiedAt = $completedAt | .restoreEvidence = {file: $evidenceFile, sha256: $evidenceSha256}' "$marker_file" > "$marker_file.tmp"
mv "$marker_file.tmp" "$marker_file"
chmod 600 "$marker_file"
backup_upload_offsite "$evidence"
if [[ -n "${migration_report:-}" ]]; then backup_upload_offsite "$migration_report"; fi
backup_upload_offsite "$marker_file"

if [[ "${BACKUP_DRILL_RETAIN_RESTORE:-0}" != "1" ]]; then
  rm -rf -- "$target_root"
fi
backup_log "Restore drill for $bundle_id passed; human review of the evidence remains required."
printf '%s\n' "$evidence"
