#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/backup/backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

on_error() {
  local status=$?
  backup_notify_failure "backup-prune-failed"
  exit "$status"
}
trap on_error ERR

usage() {
  cat >&2 <<'EOF'
Usage: prune-backups.sh [--backup-dir DIR] [--dry-run]
EOF
}

backup_dir="${BACKUP_OUTPUT_DIR:-/var/backups/scalesmiths}"
while (( $# > 0 )); do
  case "$1" in
    --backup-dir) backup_dir="${2:-}"; shift 2 ;;
    --dry-run) BACKUP_DRY_RUN=1; shift ;;
    --help) usage; exit 0 ;;
    *) usage; backup_die "Unknown argument: $1" ;;
  esac
done

backup_require_command jq
backup_require_command date
backup_require_command readlink
backup_dir="$(readlink -f "$backup_dir")"
[[ -d "$backup_dir" ]] || backup_die "Backup directory does not exist."
if ! backup_is_dry_run; then
  backup_require_command flock
  lock_file="${BACKUP_LOCK_FILE:-/run/lock/scalesmiths-backup.lock}"
  exec 9>"$lock_file"
  flock -n 9 || backup_die "Another backup or prune operation is already running."
fi

daily_days="${BACKUP_RETENTION_DAILY_DAYS:-14}"
weekly_weeks="${BACKUP_RETENTION_WEEKLY_WEEKS:-8}"
monthly_months="${BACKUP_RETENTION_MONTHLY_MONTHS:-12}"
minimum_verified="${BACKUP_MIN_VERIFIED_RECOVERY_POINTS:-3}"
for value in "$daily_days" "$weekly_weeks" "$monthly_months" "$minimum_verified"; do
  [[ "$value" =~ ^[0-9]+$ ]] || backup_die "Retention values must be non-negative integers."
done
(( minimum_verified >= 2 )) || backup_die "At least two newest verified recovery points must be retained."

declare -a ordered_markers=()
declare -A created_by_marker=()
declare -A keep=()
while IFS=$'\t' read -r created marker; do
  [[ -n "$created" && -n "$marker" ]] || continue
  ordered_markers+=("$marker")
  created_by_marker["$marker"]="$created"
done < <(
  shopt -s nullglob
  for marker in "$backup_dir"/*.verified.json; do
    if jq -e '.integrityVerified == true and (.createdAt | type == "string") and (.bundleFilename | type == "string")' "$marker" >/dev/null 2>&1; then
      filename="$(jq -r '.bundleFilename' "$marker")"
      [[ "$filename" == "$(basename "$filename")" ]] || continue
      [[ -f "$backup_dir/$filename" && -f "$backup_dir/$filename.sha256" ]] || continue
      printf '%s\t%s\n' "$(jq -r '.createdAt' "$marker")" "$marker"
    fi
  done | sort -r
)

(( ${#ordered_markers[@]} > 0 )) || backup_die "No complete integrity-verified recovery points were found; refusing to prune."
for (( index=0; index<minimum_verified && index<${#ordered_markers[@]}; index+=1 )); do
  keep["${ordered_markers[$index]}"]=1
done

newest_restore_verified=""
declare -A daily_bucket=()
declare -A weekly_bucket=()
declare -A monthly_bucket=()
daily_cutoff="$(date -u -d "$daily_days days ago" '+%Y-%m-%dT%H:%M:%SZ')"
weekly_cutoff="$(date -u -d "$(( weekly_weeks * 7 )) days ago" '+%Y-%m-%dT%H:%M:%SZ')"
monthly_cutoff="$(date -u -d "$monthly_months months ago" '+%Y-%m-%dT%H:%M:%SZ')"

for marker in "${ordered_markers[@]}"; do
  created="${created_by_marker[$marker]}"
  if [[ -z "$newest_restore_verified" && "$(jq -r '.restoreVerifiedAt // empty' "$marker")" != "" ]]; then
    newest_restore_verified="$marker"
    keep["$marker"]=1
  fi
  if (( daily_days > 0 )) && [[ "$created" > "$daily_cutoff" || "$created" == "$daily_cutoff" ]]; then
    bucket="${created:0:10}"
    if [[ -z "${daily_bucket[$bucket]:-}" ]]; then daily_bucket["$bucket"]="$marker"; keep["$marker"]=1; fi
  fi
  if (( weekly_weeks > 0 )) && [[ "$created" > "$weekly_cutoff" || "$created" == "$weekly_cutoff" ]]; then
    bucket="$(date -u -d "$created" '+%G-%V')"
    if [[ -z "${weekly_bucket[$bucket]:-}" ]]; then weekly_bucket["$bucket"]="$marker"; keep["$marker"]=1; fi
  fi
  if (( monthly_months > 0 )) && [[ "$created" > "$monthly_cutoff" || "$created" == "$monthly_cutoff" ]]; then
    bucket="${created:0:7}"
    if [[ -z "${monthly_bucket[$bucket]:-}" ]]; then monthly_bucket["$bucket"]="$marker"; keep["$marker"]=1; fi
  fi
done

deleted=0
for marker in "${ordered_markers[@]}"; do
  [[ -z "${keep[$marker]:-}" ]] || continue
  filename="$(jq -r '.bundleFilename' "$marker")"
  bundle="$backup_dir/$filename"
  checksum="$bundle.sha256"
  for candidate in "$bundle" "$checksum" "$marker"; do
    [[ "$(dirname "$(readlink -f "$candidate")")" == "$backup_dir" ]] || backup_die "Prune candidate escaped the configured backup directory."
  done
  if backup_is_dry_run; then
    backup_log "[dry-run] prune verified recovery point $(jq -r '.backupIdentifier' "$marker")"
  else
    rm -- "$bundle" "$checksum" "$marker"
  fi
  deleted=$(( deleted + 1 ))
done

backup_log "Retention evaluation complete: ${#ordered_markers[@]} verified points, $deleted eligible for pruning, newest $minimum_verified always protected."
