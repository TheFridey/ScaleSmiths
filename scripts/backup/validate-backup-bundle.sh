#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/backup/backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

on_error() {
  local status=$?
  backup_notify_failure "backup-validation-failed"
  exit "$status"
}
trap on_error ERR

usage() {
  cat >&2 <<'EOF'
Usage: validate-backup-bundle.sh --bundle FILE [--extract-to EMPTY_DIR] [--dry-run]
EOF
}

bundle=""
extract_to=""
while (( $# > 0 )); do
  case "$1" in
    --bundle) bundle="${2:-}"; shift 2 ;;
    --extract-to) extract_to="${2:-}"; shift 2 ;;
    --dry-run) BACKUP_DRY_RUN=1; shift ;;
    --help) usage; exit 0 ;;
    *) usage; backup_die "Unknown argument: $1" ;;
  esac
done

[[ -n "$bundle" ]] || backup_die "--bundle is required."
bundle="$(readlink -f "$bundle")"
[[ -f "$bundle" && ! -L "$bundle" ]] || backup_die "Bundle must be a regular, non-symlink file."
checksum_file="$bundle.sha256"
marker_file="$bundle.verified.json"
[[ -f "$checksum_file" && ! -L "$checksum_file" ]] || backup_die "Bundle checksum sidecar is missing."
[[ -f "$marker_file" && ! -L "$marker_file" ]] || backup_die "Bundle verification marker is missing."

backup_require_command jq
backup_require_command tar
backup_require_command sha256sum
backup_require_command pg_restore

jq -e 'type == "object" and .integrityVerified == true and (.bundleSha256 | type == "string")' "$marker_file" >/dev/null
actual_sha="$(backup_sha256_file "$bundle")"
marker_sha="$(jq -r '.bundleSha256' "$marker_file")"
[[ "$actual_sha" == "$marker_sha" ]] || backup_die "Bundle checksum does not match its verification marker."
(
  cd "$(dirname "$bundle")"
  sha256sum --check "$(basename "$checksum_file")" >/dev/null
)

if backup_is_dry_run; then
  backup_log "[dry-run] checksum sidecars are valid; encrypted payload was not decrypted or extracted"
  exit 0
fi

work_dir="$(mktemp -d "${BACKUP_TEMP_ROOT:-${TMPDIR:-/tmp}}/scalesmiths-validate.XXXXXXXX")"
chmod 700 "$work_dir"
archive="$work_dir/bundle.tar.gz"
managed_extract=0
if [[ -z "$extract_to" ]]; then
  extract_to="$work_dir/extracted"
  managed_extract=1
else
  extract_parent="$(readlink -f "$(dirname "$extract_to")")"
  extract_to="$extract_parent/$(basename "$extract_to")"
  if [[ -e "$extract_to" ]]; then
    [[ -d "$extract_to" && -z "$(find "$extract_to" -mindepth 1 -maxdepth 1 -print -quit)" ]] || backup_die "--extract-to must not exist or must be an empty directory."
  fi
fi
mkdir -p "$extract_to"
chmod 700 "$extract_to"

cleanup() {
  rm -f -- "$archive"
  if (( managed_extract == 1 )); then rm -rf -- "$extract_to"; fi
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

backup_decrypt_bundle "$bundle" "$archive"
backup_validate_tar_names "$archive"
declare -A bundle_members=()
while IFS= read -r entry; do
  entry="${entry#./}"
  entry="${entry%/}"
  [[ -n "$entry" ]] || continue
  [[ -z "${bundle_members[$entry]:-}" ]] || backup_die "Bundle archive contains a duplicate member."
  bundle_members["$entry"]=1
  case "$entry" in
    configuration|data|metadata|manifest.json|SHA256SUMS|configuration/production.env|data/postgres.dump|data/generated-sites.tar.gz|data/release-metadata.tar.gz|data/host-nginx.tar.gz|metadata/web-migration-journal.json|metadata/admin-migration-journal.json|metadata/migration-state.json|metadata/migration-checksums.json|metadata/image-digests.json|metadata/operational-key-ownership.json) ;;
    *) backup_die "Bundle archive contains an unrecognised member." ;;
  esac
done < <(tar -tzf "$archive")
tar --extract --gzip --file="$archive" --directory="$extract_to" --no-same-owner --no-same-permissions

unsafe_entry="$(find "$extract_to" ! -type f ! -type d -print -quit)"
[[ -z "$unsafe_entry" ]] || backup_die "Bundle contains a symbolic link or special filesystem entry."

required_files=(manifest.json SHA256SUMS configuration/production.env data/postgres.dump data/generated-sites.tar.gz data/release-metadata.tar.gz data/host-nginx.tar.gz metadata/web-migration-journal.json metadata/admin-migration-journal.json metadata/migration-state.json metadata/image-digests.json metadata/operational-key-ownership.json)
for required in "${required_files[@]}"; do
  [[ -f "$extract_to/$required" && ! -L "$extract_to/$required" ]] || backup_die "Bundle is missing required content: $required"
done

(
  cd "$extract_to"
  sha256sum --check SHA256SUMS >/dev/null
)
backup_validate_tar_names "$extract_to/data/generated-sites.tar.gz"
backup_validate_tar_names "$extract_to/data/release-metadata.tar.gz"
backup_validate_tar_names "$extract_to/data/host-nginx.tar.gz"
pg_restore --list "$extract_to/data/postgres.dump" >/dev/null

jq -e 'type == "object" and .formatVersion == 1 and (.backupIdentifier | type == "string") and (.sourceRelease | type == "string")' "$extract_to/manifest.json" >/dev/null
jq -e 'type == "object" and (.web | type == "array") and (.admin | type == "array")' "$extract_to/metadata/migration-state.json" >/dev/null
jq -e 'type == "object" and (.images | type == "array")' "$extract_to/metadata/image-digests.json" >/dev/null
jq -e 'type == "object" and .plaintextKeyMaterialIncluded == false and (.keyOwner | type == "string") and (.keyId | type == "string")' "$extract_to/metadata/operational-key-ownership.json" >/dev/null

bundle_id="$(jq -r '.backupIdentifier' "$extract_to/manifest.json")"
marker_id="$(jq -r '.backupIdentifier' "$marker_file")"
[[ "$bundle_id" == "$marker_id" ]] || backup_die "Bundle identifier does not match its verification marker."
backup_log "Backup bundle $bundle_id passed checksum, archive, PostgreSQL dump and metadata validation."
printf '%s\n' "$bundle_id"
