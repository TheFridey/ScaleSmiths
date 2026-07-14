#!/usr/bin/env bash

# Shared by the operator-facing backup entrypoints. Entry scripts must enable
# strict mode before sourcing this file.

BACKUP_PRODUCTION_ROOT="${BACKUP_PRODUCTION_ROOT:-/var/www/scalesmiths/ScaleSmiths}"

backup_log() {
  printf '%s\n' "$*" >&2
}

backup_die() {
  backup_log "ERROR: $*"
  return 1
}

backup_require_command() {
  command -v "$1" >/dev/null 2>&1 || backup_die "Required command is unavailable: $1"
}

backup_notify_failure() {
  local event="$1"
  local hook="${BACKUP_FAILURE_HOOK:-}"
  [[ -n "$hook" ]] || return 0
  [[ "$hook" = /* && -x "$hook" && ! -L "$hook" ]] || {
    backup_log "WARNING: failure hook is not an absolute executable regular file; notification skipped."
    return 0
  }
  env -i PATH="$PATH" BACKUP_EVENT="$event" BACKUP_HOST="$(hostname -f 2>/dev/null || hostname)" "$hook" "$event" >/dev/null 2>&1 || backup_log "WARNING: configured failure hook returned an error."
}

backup_is_dry_run() {
  [[ "${BACKUP_DRY_RUN:-0}" == "1" ]]
}

backup_load_database_url() {
  if [[ -n "${BACKUP_DATABASE_URL_FILE:-}" ]]; then
    [[ -f "$BACKUP_DATABASE_URL_FILE" && ! -L "$BACKUP_DATABASE_URL_FILE" ]] || backup_die "BACKUP_DATABASE_URL_FILE must be a regular, non-symlink file."
    local permissions
    permissions="$(stat -c '%a' "$BACKUP_DATABASE_URL_FILE")"
    (( (8#$permissions & 077) == 0 )) || backup_die "BACKUP_DATABASE_URL_FILE must not be group/world accessible."
    IFS= read -r BACKUP_DATABASE_URL < "$BACKUP_DATABASE_URL_FILE" || true
  fi
  [[ -n "${BACKUP_DATABASE_URL:-}" ]] || backup_die "Set BACKUP_DATABASE_URL or BACKUP_DATABASE_URL_FILE."
  export BACKUP_DATABASE_URL
}

backup_parse_database_target() {
  local database_url="$1"
  BACKUP_DATABASE_URL_VALUE="$database_url" node -e '
    const value = process.env.BACKUP_DATABASE_URL_VALUE;
    let url;
    try { url = new URL(value); } catch { process.exit(2); }
    if (!["postgres:", "postgresql:"].includes(url.protocol)) process.exit(3);
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!host || !database || /[\r\n\t]/.test(host + database)) process.exit(4);
    process.stdout.write(host + "\t" + database);
  ' || backup_die "Database URL must be a valid PostgreSQL URL with a host and database."
}

backup_prepare_pg_environment() {
  local database_url="$1"
  local state_dir="$2"
  backup_require_command base64
  backup_require_command jq
  backup_require_command node
  [[ "$database_url" != *$'\r'* && "$database_url" != *$'\n'* ]] || backup_die "Database URL contains control characters."
  mkdir -p "$state_dir"
  chmod 700 "$state_dir"
  local pgpass_file="$state_dir/pgpass"
  local environment_file="$state_dir/environment.json"
  BACKUP_DATABASE_URL_VALUE="$database_url" BACKUP_PGPASS_FILE="$pgpass_file" BACKUP_PG_ENVIRONMENT_FILE="$environment_file" node -e '
    const fs = require("node:fs");
    let url;
    try { url = new URL(process.env.BACKUP_DATABASE_URL_VALUE); } catch { process.exit(2); }
    if (!["postgres:", "postgresql:"].includes(url.protocol)) process.exit(3);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const values = [url.hostname, url.port, username, password, database, ...url.searchParams.values()];
    if (!url.hostname || !url.username || !database || values.some((value) => /[\r\n\t\0]/.test(value))) process.exit(4);
    const parameterEnvironment = new Map([
      ["application_name", "PGAPPNAME"], ["channel_binding", "PGCHANNELBINDING"],
      ["client_encoding", "PGCLIENTENCODING"], ["connect_timeout", "PGCONNECT_TIMEOUT"],
      ["gssencmode", "PGGSSENCMODE"], ["keepalives", "PGKEEPALIVES"],
      ["keepalives_count", "PGKEEPALIVESCOUNT"], ["keepalives_idle", "PGKEEPALIVESIDLE"],
      ["keepalives_interval", "PGKEEPALIVESINTERVAL"], ["krbsrvname", "PGKRBSRVNAME"],
      ["options", "PGOPTIONS"], ["requirepeer", "PGREQUIREPEER"],
      ["sslcert", "PGSSLCERT"], ["sslcrl", "PGSSLCRL"], ["sslcrldir", "PGSSLCRLDIR"],
      ["sslkey", "PGSSLKEY"], ["sslmode", "PGSSLMODE"],
      ["sslrootcert", "PGSSLROOTCERT"], ["ssl_max_protocol_version", "PGSSLMAXPROTOCOLVERSION"],
      ["ssl_min_protocol_version", "PGSSLMINPROTOCOLVERSION"],
      ["target_session_attrs", "PGTARGETSESSIONATTRS"], ["tcp_user_timeout", "PGTCPUSER_TIMEOUT"]
    ]);
    const environment = {
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGDATABASE: database,
      PGUSER: username,
      PGPASSFILE: process.env.BACKUP_PGPASS_FILE,
      PGAPPNAME: "scalesmiths-backup"
    };
    for (const [key, value] of url.searchParams) {
      if (!parameterEnvironment.has(key)) process.exit(5);
      environment[parameterEnvironment.get(key)] = value;
    }
    const escapePgpass = (value) => value.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    const pgpass = [url.hostname, url.port || "5432", database, username, password].map(escapePgpass).join(":") + "\n";
    fs.writeFileSync(process.env.BACKUP_PGPASS_FILE, pgpass, { mode: 0o600 });
    fs.writeFileSync(process.env.BACKUP_PG_ENVIRONMENT_FILE, JSON.stringify({ environment }), { mode: 0o600 });
  ' || backup_die "Database URL uses unsupported or unsafe connection parameters."
  chmod 600 "$pgpass_file" "$environment_file"
  BACKUP_PG_ENV=()
  local key encoded value
  while IFS=$'\t' read -r key encoded; do
    [[ "$key" =~ ^PG[A-Z0-9_]+$ ]] || backup_die "Unsafe PostgreSQL environment key was generated."
    value="$(printf '%s' "$encoded" | base64 --decode)"
    BACKUP_PG_ENV+=("$key=$value")
  done < <(jq -r '.environment | to_entries[] | [.key, (.value | @base64)] | @tsv' "$environment_file")
  (( ${#BACKUP_PG_ENV[@]} >= 6 )) || backup_die "Failed to prepare the PostgreSQL connection environment."
}

backup_assert_secret_file() {
  local file="$1"
  local label="$2"
  [[ -f "$file" && ! -L "$file" ]] || backup_die "$label must be a regular, non-symlink file."
  local permissions
  permissions="$(stat -c '%a' "$file")"
  (( (8#$permissions & 077) == 0 )) || backup_die "$label must not be group/world accessible."
}

backup_sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}

backup_validate_tar_names() {
  local archive="$1"
  local compression="${2:-gzip}"
  local list_args=(-tf "$archive")
  [[ "$compression" == "gzip" ]] && list_args=(-tzf "$archive")
  local entry
  while IFS= read -r entry; do
    [[ -n "$entry" ]] || continue
    [[ "$entry" != /* ]] || backup_die "Archive contains an absolute path."
    [[ ! "$entry" =~ (^|/)\.\.(/|$) ]] || backup_die "Archive contains a parent-directory traversal."
  done < <(tar "${list_args[@]}")
}

backup_validate_source_tree() {
  local root="$1"
  local unsafe_entry
  unsafe_entry="$(find "$root" ! -type f ! -type d ! -type l -print -quit)"
  [[ -z "$unsafe_entry" ]] || backup_die "Backup source contains a socket, device, FIFO, or other unsupported filesystem entry."

  local link target resolved
  while IFS= read -r -d '' link; do
    target="$(readlink "$link")"
    [[ "$target" != /* ]] || backup_die "Backup source contains an absolute symbolic link."
    resolved="$(readlink -f "$link")" || backup_die "Backup source contains a broken symbolic link."
    case "$resolved" in "$root"|"$root"/*) ;; *) backup_die "Backup source contains a symbolic link that escapes its source root." ;; esac
  done < <(find "$root" -type l -print0)
}

backup_encrypt_archive() {
  local archive="$1"
  local output_base="$2"
  if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
    backup_require_command age
    BACKUP_ENCRYPTION_MODE="age-recipient"
    BACKUP_ENCRYPTED_BUNDLE="${output_base}.age"
    age --recipient "$BACKUP_AGE_RECIPIENT" --output "$BACKUP_ENCRYPTED_BUNDLE" "$archive"
  elif [[ -n "${BACKUP_GPG_PASSPHRASE_FILE:-}" ]]; then
    backup_require_command gpg
    backup_assert_secret_file "$BACKUP_GPG_PASSPHRASE_FILE" "BACKUP_GPG_PASSPHRASE_FILE"
    BACKUP_ENCRYPTION_MODE="gpg-symmetric"
    BACKUP_ENCRYPTED_BUNDLE="${output_base}.gpg"
    local gpg_home="${GNUPGHOME:-$(dirname "$archive")/.gnupg}"
    mkdir -p "$gpg_home"
    chmod 700 "$gpg_home"
    GNUPGHOME="$gpg_home" gpg --batch --yes --pinentry-mode loopback --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" --symmetric --cipher-algo AES256 --output "$BACKUP_ENCRYPTED_BUNDLE" "$archive"
  elif [[ "${BACKUP_ENVIRONMENT:-}" == "test" && "${BACKUP_ALLOW_UNENCRYPTED:-0}" == "1" ]]; then
    BACKUP_ENCRYPTION_MODE="test-only-unencrypted"
    BACKUP_ENCRYPTED_BUNDLE="${output_base}.tar.gz"
    mv "$archive" "$BACKUP_ENCRYPTED_BUNDLE"
  else
    backup_die "Encryption is mandatory: configure BACKUP_AGE_RECIPIENT or BACKUP_GPG_PASSPHRASE_FILE."
  fi
  export BACKUP_ENCRYPTION_MODE BACKUP_ENCRYPTED_BUNDLE
}

backup_decrypt_bundle() {
  local bundle="$1"
  local output="$2"
  case "$bundle" in
    *.age)
      backup_require_command age
      [[ -n "${BACKUP_AGE_IDENTITY_FILE:-}" ]] || backup_die "BACKUP_AGE_IDENTITY_FILE is required for age decryption."
      backup_assert_secret_file "$BACKUP_AGE_IDENTITY_FILE" "BACKUP_AGE_IDENTITY_FILE"
      age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" --output "$output" "$bundle"
      ;;
    *.gpg)
      backup_require_command gpg
      [[ -n "${BACKUP_GPG_PASSPHRASE_FILE:-}" ]] || backup_die "BACKUP_GPG_PASSPHRASE_FILE is required for GPG decryption."
      backup_assert_secret_file "$BACKUP_GPG_PASSPHRASE_FILE" "BACKUP_GPG_PASSPHRASE_FILE"
      local gpg_home="${GNUPGHOME:-$(dirname "$output")/.gnupg}"
      mkdir -p "$gpg_home"
      chmod 700 "$gpg_home"
      GNUPGHOME="$gpg_home" gpg --batch --yes --pinentry-mode loopback --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" --decrypt --output "$output" "$bundle"
      ;;
    *.tar.gz)
      [[ "${BACKUP_ENVIRONMENT:-}" == "test" && "${BACKUP_ALLOW_UNENCRYPTED:-0}" == "1" ]] || backup_die "Unencrypted bundles are accepted only in the explicit test environment."
      cp "$bundle" "$output"
      ;;
    *)
      backup_die "Unsupported bundle encryption suffix."
      ;;
  esac
}

backup_upload_offsite() {
  local file="$1"
  local destination="${BACKUP_OFFSITE_DESTINATION:-}"
  [[ -n "$destination" ]] || return 0
  backup_require_command rclone
  local remote
  remote="${destination%/}/$(basename "$file")"
  if backup_is_dry_run; then
    backup_log "[dry-run] upload $(basename "$file") to the configured off-host destination"
  else
    rclone copyto -- "$file" "$remote"
  fi
}
