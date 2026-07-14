#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/backup/backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

on_error() {
  local status=$?
  backup_notify_failure "backup-create-failed"
  exit "$status"
}
trap on_error ERR

usage() {
  cat >&2 <<'EOF'
Usage: create-backup-bundle.sh [--backup-id ID] [--output-dir DIR] [--dry-run]
EOF
}

backup_id=""
output_dir="${BACKUP_OUTPUT_DIR:-/var/backups/scalesmiths}"
while (( $# > 0 )); do
  case "$1" in
    --backup-id) backup_id="${2:-}"; shift 2 ;;
    --output-dir) output_dir="${2:-}"; shift 2 ;;
    --dry-run) BACKUP_DRY_RUN=1; shift ;;
    --help) usage; exit 0 ;;
    *) usage; backup_die "Unknown argument: $1" ;;
  esac
done

backup_require_command node
backup_require_command jq
backup_require_command tar
backup_require_command sha256sum
backup_require_command pg_dump
backup_require_command pg_restore
backup_require_command psql
backup_require_command stat
backup_require_command readlink

source_root="$(readlink -f "${BACKUP_SOURCE_ROOT:-$BACKUP_PRODUCTION_ROOT}")"
[[ -d "$source_root" ]] || backup_die "Backup source root does not exist."
env_file="$(readlink -f "${BACKUP_ENV_FILE:-$source_root/.env}")"
generated_sites="$(readlink -f "${BACKUP_GENERATED_SITES_DIR:-$source_root/generated-sites}")"
release_root="$(readlink -f "${BACKUP_RELEASE_ROOT:-/var/lib/scalesmiths-release}")"
compose_file="$(readlink -f "${BACKUP_COMPOSE_FILE:-$source_root/docker-compose.host-nginx.yml}")"

[[ -f "$env_file" && ! -L "$env_file" ]] || backup_die "Production environment file is missing or is a symlink."
[[ -d "$generated_sites" && ! -L "$generated_sites" ]] || backup_die "generated-sites source is missing or is a symlink."
[[ -d "$release_root" && ! -L "$release_root" ]] || backup_die "Release metadata root is missing or is a symlink."
[[ -f "$release_root/state.json" ]] || backup_die "Release state metadata is missing."
jq -e 'type == "object"' "$release_root/state.json" >/dev/null
[[ -f "$compose_file" ]] || backup_die "Production Compose file is missing."
[[ -f "$source_root/web/drizzle/meta/_journal.json" ]] || backup_die "Web migration journal is missing."
[[ -f "$source_root/admin/drizzle/meta/_journal.json" ]] || backup_die "Admin migration journal is missing."

case "$generated_sites/" in "$source_root/"*) ;; *) backup_die "generated-sites must be inside the configured source root." ;; esac
case "$env_file" in "$source_root/"*) ;; *) backup_die "Production environment file must be inside the configured source root." ;; esac

[[ -n "${BACKUP_NGINX_PATHS:-}" ]] || backup_die "BACKUP_NGINX_PATHS must list the reviewed host Nginx paths."
IFS=':' read -r -a nginx_paths <<< "$BACKUP_NGINX_PATHS"
(( ${#nginx_paths[@]} > 0 )) || backup_die "No Nginx paths were configured."
nginx_relative=()
for nginx_path in "${nginx_paths[@]}"; do
  [[ "$nginx_path" = /* ]] || backup_die "Every Nginx backup path must be absolute."
  nginx_real="$(readlink -f "$nginx_path")"
  [[ -e "$nginx_real" ]] || backup_die "A configured Nginx path does not exist."
  nginx_relative+=("${nginx_real#/}")
done

backup_validate_source_tree "$generated_sites"
backup_validate_source_tree "$release_root"
for nginx_path in "${nginx_paths[@]}"; do
  backup_validate_source_tree "$(readlink -f "$nginx_path")"
done

[[ "${BACKUP_RPO_HOURS:-}" =~ ^[1-9][0-9]*$ ]] || backup_die "BACKUP_RPO_HOURS must be a positive integer."
[[ "${BACKUP_RTO_MINUTES:-}" =~ ^[1-9][0-9]*$ ]] || backup_die "BACKUP_RTO_MINUTES must be a positive integer."
[[ -n "${BACKUP_OPERATIONAL_KEY_OWNER:-}" ]] || backup_die "BACKUP_OPERATIONAL_KEY_OWNER is required."
[[ -n "${BACKUP_OPERATIONAL_KEY_ID:-}" ]] || backup_die "BACKUP_OPERATIONAL_KEY_ID is required."
key_metadata="$BACKUP_OPERATIONAL_KEY_OWNER$BACKUP_OPERATIONAL_KEY_ID"
[[ "$key_metadata" != *$'\r'* && "$key_metadata" != *$'\n'* && "$key_metadata" != *$'\t'* ]] || backup_die "Key ownership metadata contains control characters."

if [[ -n "${BACKUP_AGE_RECIPIENT:-}" && -n "${BACKUP_GPG_PASSPHRASE_FILE:-}" ]]; then
  backup_die "Configure exactly one encryption mode, not both age and GPG."
elif [[ -n "${BACKUP_GPG_PASSPHRASE_FILE:-}" ]]; then
  backup_assert_secret_file "$BACKUP_GPG_PASSPHRASE_FILE" "BACKUP_GPG_PASSPHRASE_FILE"
elif [[ -z "${BACKUP_AGE_RECIPIENT:-}" && ! ("${BACKUP_ENVIRONMENT:-}" == "test" && "${BACKUP_ALLOW_UNENCRYPTED:-0}" == "1") ]]; then
  backup_die "Encryption configuration is required."
fi
if [[ "${BACKUP_OFFSITE_REQUIRED:-0}" == "1" && -z "${BACKUP_OFFSITE_DESTINATION:-}" ]]; then
  backup_die "BACKUP_OFFSITE_REQUIRED=1 but BACKUP_OFFSITE_DESTINATION is unset."
fi

if [[ -z "$backup_id" ]]; then
  source_commit="$(git -C "$source_root" rev-parse --short=12 HEAD 2>/dev/null || printf 'unknown')"
  backup_id="$(date -u '+%Y%m%dT%H%M%SZ')-$source_commit"
fi
[[ "$backup_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$ ]] || backup_die "Backup ID contains unsupported characters."

output_parent="$(readlink -f "$(dirname "$output_dir")")"
output_dir="$output_parent/$(basename "$output_dir")"
case "$output_dir/" in "$source_root/"*) backup_die "Backup output must not be inside the production repository." ;; esac
bundle_base="$output_dir/scalesmiths-backup-$backup_id"
if compgen -G "${bundle_base}*" >/dev/null 2>&1; then
  backup_die "A backup with this identifier already exists."
fi

if backup_is_dry_run; then
  backup_log "[dry-run] create encrypted ScaleSmiths backup $backup_id"
  backup_log "[dry-run] scope: PostgreSQL, production environment, host Nginx, generated-sites, release metadata, migration journals and image digests"
  backup_log "[dry-run] output directory and off-host destination are configured; no files, dumps or uploads were created"
  exit 0
fi

backup_require_command flock
lock_file="${BACKUP_LOCK_FILE:-/run/lock/scalesmiths-backup.lock}"
exec 9>"$lock_file"
flock -n 9 || backup_die "Another backup or prune operation is already running."
backup_load_database_url
mkdir -p "$output_dir"
chmod 700 "$output_dir"
temp_root="${BACKUP_TEMP_ROOT:-${TMPDIR:-/tmp}}"
[[ -d "$temp_root" ]] || backup_die "BACKUP_TEMP_ROOT does not exist."
work_dir="$(mktemp -d "$temp_root/scalesmiths-backup.XXXXXXXX")"
chmod 700 "$work_dir"
archive="$work_dir/scalesmiths-backup-$backup_id.tar.gz"
stage="$work_dir/bundle"
mkdir -p "$stage"/{configuration,data,metadata}

cleanup() {
  rm -rf -- "$work_dir"
}
trap cleanup EXIT
backup_prepare_pg_environment "$BACKUP_DATABASE_URL" "$work_dir/postgresql"
source_pg_env=("${BACKUP_PG_ENV[@]}")

backup_log "Creating backup $backup_id."
env "${source_pg_env[@]}" pg_dump --format=custom --compress=9 --no-owner --no-privileges --file="$stage/data/postgres.dump"
pg_restore --list "$stage/data/postgres.dump" >/dev/null

install -m 600 "$env_file" "$stage/configuration/production.env"
tar -C "$source_root" -czf "$stage/data/generated-sites.tar.gz" "generated-sites"
tar -C "$(dirname "$release_root")" -czf "$stage/data/release-metadata.tar.gz" "$(basename "$release_root")"
tar -C / -czf "$stage/data/host-nginx.tar.gz" "${nginx_relative[@]}"
backup_validate_tar_names "$stage/data/generated-sites.tar.gz"
backup_validate_tar_names "$stage/data/release-metadata.tar.gz"
backup_validate_tar_names "$stage/data/host-nginx.tar.gz"

install -m 600 "$source_root/web/drizzle/meta/_journal.json" "$stage/metadata/web-migration-journal.json"
install -m 600 "$source_root/admin/drizzle/meta/_journal.json" "$stage/metadata/admin-migration-journal.json"
if [[ -f "$source_root/scripts/migration-checksums.json" ]]; then
  install -m 600 "$source_root/scripts/migration-checksums.json" "$stage/metadata/migration-checksums.json"
fi

capture_journal() {
  local table="$1"
  local output="$2"
  local exists
  exists="$(env "${source_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command="SELECT to_regclass('drizzle.\"$table\"') IS NOT NULL")"
  if [[ "$exists" == "t" ]]; then
    env "${source_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command="SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) FROM (SELECT id, hash, created_at::text AS created_at FROM drizzle.\"$table\" ORDER BY id) m" > "$output"
  else
    printf '[]\n' > "$output"
  fi
  jq -e 'type == "array"' "$output" >/dev/null
}
capture_journal "__drizzle_web_migrations" "$work_dir/web-journal-state.json"
capture_journal "__drizzle_migrations" "$work_dir/admin-journal-state.json"
jq -n --slurpfile web "$work_dir/web-journal-state.json" --slurpfile admin "$work_dir/admin-journal-state.json" '{web: $web[0], admin: $admin[0]}' > "$stage/metadata/migration-state.json"

if [[ -n "${BACKUP_IMAGE_DIGESTS_SOURCE_FILE:-}" ]]; then
  [[ -f "$BACKUP_IMAGE_DIGESTS_SOURCE_FILE" && ! -L "$BACKUP_IMAGE_DIGESTS_SOURCE_FILE" ]] || backup_die "BACKUP_IMAGE_DIGESTS_SOURCE_FILE must be a regular file."
  jq -e 'type == "object" and (.images | type == "array")' "$BACKUP_IMAGE_DIGESTS_SOURCE_FILE" >/dev/null
  install -m 600 "$BACKUP_IMAGE_DIGESTS_SOURCE_FILE" "$stage/metadata/image-digests.json"
else
  backup_require_command docker
  mapfile -t images < <(docker compose -f "$compose_file" config --images | sort -u)
  (( ${#images[@]} > 0 )) || backup_die "No production images were resolved from Compose."
  : > "$work_dir/image-digests.jsonl"
  for image in "${images[@]}"; do
    image_id="$(docker image inspect --format '{{.Id}}' "$image")"
    repo_digests="$(docker image inspect --format '{{json .RepoDigests}}' "$image")"
    jq -cn --arg image "$image" --arg imageId "$image_id" --argjson repoDigests "${repo_digests:-null}" '{image: $image, imageId: $imageId, repoDigests: ($repoDigests // [])}' >> "$work_dir/image-digests.jsonl"
  done
  jq -s --arg capturedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" '{capturedAt: $capturedAt, images: .}' "$work_dir/image-digests.jsonl" > "$stage/metadata/image-digests.json"
fi

env_permissions="$(stat -c '%a' "$env_file")"
env_uid="$(stat -c '%u' "$env_file")"
env_gid="$(stat -c '%g' "$env_file")"
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/ && $1 ~ /(KEY|SECRET|PASSWORD|TOKEN)$/ { print $1 }' "$env_file" | jq -R . | jq -s . > "$work_dir/sensitive-variable-names.json"
encryption_reference=""
encryption_file_mode=null
encryption_file_uid=null
encryption_file_gid=null
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  encryption_reference="$(printf '%s' "$BACKUP_AGE_RECIPIENT" | sha256sum | awk '{print $1}')"
elif [[ -n "${BACKUP_GPG_PASSPHRASE_FILE:-}" ]]; then
  encryption_reference="$(basename "$BACKUP_GPG_PASSPHRASE_FILE")"
  encryption_file_mode="$(stat -c '%a' "$BACKUP_GPG_PASSPHRASE_FILE")"
  encryption_file_uid="$(stat -c '%u' "$BACKUP_GPG_PASSPHRASE_FILE")"
  encryption_file_gid="$(stat -c '%g' "$BACKUP_GPG_PASSPHRASE_FILE")"
fi
jq -n --arg owner "$BACKUP_OPERATIONAL_KEY_OWNER" --arg keyId "$BACKUP_OPERATIONAL_KEY_ID" --arg envPath "$env_file" --arg envMode "$env_permissions" --argjson envUid "$env_uid" --argjson envGid "$env_gid" --arg encryptionReference "$encryption_reference" --argjson encryptionFileMode "${encryption_file_mode:-null}" --argjson encryptionFileUid "${encryption_file_uid:-null}" --argjson encryptionFileGid "${encryption_file_gid:-null}" --slurpfile sensitiveNames "$work_dir/sensitive-variable-names.json" '{keyOwner: $owner, keyId: $keyId, environmentFile: {path: $envPath, mode: $envMode, uid: $envUid, gid: $envGid, sensitiveVariableNames: $sensitiveNames[0]}, encryptionCredential: {reference: $encryptionReference, mode: $encryptionFileMode, uid: $encryptionFileUid, gid: $encryptionFileGid}, plaintextKeyMaterialIncluded: false}' > "$stage/metadata/operational-key-ownership.json"

created_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
source_release="$(jq -r '.activeReleaseId // "unknown"' "$release_root/state.json")"
source_commit="$(git -C "$source_root" rev-parse HEAD 2>/dev/null || printf 'unknown')"
postgres_server_version="$(env "${source_pg_env[@]}" psql -XAt --set=ON_ERROR_STOP=1 --command='SHOW server_version')"
postgres_client_version="$(pg_dump --version | head -n 1)"
jq -n --arg backupIdentifier "$backup_id" --arg createdAt "$created_at" --arg sourceRelease "$source_release" --arg sourceCommit "$source_commit" --arg postgresServerVersion "$postgres_server_version" --arg postgresClientVersion "$postgres_client_version" --argjson rpoHours "$BACKUP_RPO_HOURS" --argjson rtoMinutes "$BACKUP_RTO_MINUTES" '{formatVersion: 1, backupIdentifier: $backupIdentifier, createdAt: $createdAt, sourceRelease: $sourceRelease, sourceCommit: $sourceCommit, postgresql: {serverVersion: $postgresServerVersion, dumpClientVersion: $postgresClientVersion, format: "custom"}, objectives: {rpoHours: $rpoHours, rtoMinutes: $rtoMinutes}, scope: ["postgresql","production-environment","host-nginx","generated-sites","release-metadata","migration-journals","image-digests","operational-key-ownership-metadata"]}' > "$stage/manifest.json"

(
  cd "$stage"
  find . -type f -print0 | sort -z | xargs -0 sha256sum > "$work_dir/SHA256SUMS"
  mv "$work_dir/SHA256SUMS" SHA256SUMS
  sha256sum --check SHA256SUMS >/dev/null
)
tar -C "$stage" -czf "$archive" .
backup_validate_tar_names "$archive"

backup_encrypt_archive "$archive" "$bundle_base"
bundle="$BACKUP_ENCRYPTED_BUNDLE"
bundle_sha="$(backup_sha256_file "$bundle")"
checksum_file="$bundle.sha256"
marker_file="$bundle.verified.json"
printf '%s  %s\n' "$bundle_sha" "$(basename "$bundle")" > "$checksum_file.tmp"
mv "$checksum_file.tmp" "$checksum_file"
jq -n --arg backupIdentifier "$backup_id" --arg bundleFilename "$(basename "$bundle")" --arg bundleSha256 "$bundle_sha" --arg createdAt "$created_at" --arg sourceRelease "$source_release" --arg encryption "$BACKUP_ENCRYPTION_MODE" '{formatVersion: 1, backupIdentifier: $backupIdentifier, bundleFilename: $bundleFilename, bundleSha256: $bundleSha256, createdAt: $createdAt, sourceRelease: $sourceRelease, encryption: $encryption, integrityVerified: true, restoreVerifiedAt: null, restoreEvidence: null}' > "$marker_file.tmp"
mv "$marker_file.tmp" "$marker_file"
chmod 600 "$bundle" "$checksum_file" "$marker_file"

backup_upload_offsite "$bundle"
backup_upload_offsite "$checksum_file"
backup_upload_offsite "$marker_file"

backup_log "Backup $backup_id created and integrity-checked."
printf '%s\n' "$bundle"
