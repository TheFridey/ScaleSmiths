#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# ScaleSmiths VPS operational health check.
# Run periodically via systemd timer. Writes a small JSON status file.
# Calls a configured notification hook (the same BACKUP_FAILURE_HOOK pattern)
# on any critical failure.

CONFIG_FILE="${SCALESMITHS_MONITOR_CONFIG:-/etc/scalesmiths/monitor.env}"
STATUS_DIR="${SCALESMITHS_MONITOR_STATUS_DIR:-/var/lib/scalesmiths-monitor}"
STATUS_FILE="$STATUS_DIR/status.json"

# ── defaults (overridable by env file) ──
MONITOR_WEB_HEALTH_URL="${MONITOR_WEB_HEALTH_URL:-http://127.0.0.1:3100/api/health}"
MONITOR_ADMIN_HEALTH_URL="${MONITOR_ADMIN_HEALTH_URL:-http://127.0.0.1:3101/api/health}"
MONITOR_ADMIN_HEALTH_TOKEN="${MONITOR_ADMIN_HEALTH_TOKEN:-}"
MONITOR_COMPOSE_FILE="${MONITOR_COMPOSE_FILE:-/var/www/scalesmiths/ScaleSmiths/docker-compose.host-nginx.yml}"
MONITOR_CONTAINER_FILTER="${MONITOR_CONTAINER_FILTER:-scalesmiths-web\|scalesmiths-admin\|postgres}"
MONITOR_DISK_WARN_PCT="${MONITOR_DISK_WARN_PCT:-80}"
MONITOR_DISK_CRIT_PCT="${MONITOR_DISK_CRIT_PCT:-90}"
MONITOR_MEM_WARN_PCT="${MONITOR_MEM_WARN_PCT:-85}"
MONITOR_MEM_CRIT_PCT="${MONITOR_MEM_CRIT_PCT:-92}"
MONITOR_BACKUP_STALE_HOURS="${MONITOR_BACKUP_STALE_HOURS:-30}"
MONITOR_BACKUP_DIR="${MONITOR_BACKUP_DIR:-/var/backups/scalesmiths}"
MONITOR_NOTIFY_HOOK="${MONITOR_NOTIFY_HOOK:-}"

load_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    set -a
    source "$CONFIG_FILE"
    set +a
  fi
}

notify() {
  local event="$1"
  local detail="${2:-}"
  local hook="${MONITOR_NOTIFY_HOOK}"
  if [[ -z "$hook" ]]; then return 0; fi
  if [[ "$hook" != /* || ! -x "$hook" || -L "$hook" ]]; then
    echo "WARNING: notification hook is not an absolute executable regular file" >&2
    return 0
  fi
  env -i PATH="$PATH" \
    SCALESMITHS_MONITOR_EVENT="$event" \
    SCALESMITHS_MONITOR_HOST="$(hostname -f 2>/dev/null || hostname)" \
    SCALESMITHS_MONITOR_DETAIL="$detail" \
    "$hook" "$event" "$detail" >/dev/null 2>&1 || true
}

check_disk() {
  local warn=$1 crit=$2
  local status="ok" pct=0 max_pct=0 detail="" mount=""
  while IFS= read -r line; do
    pct=$(echo "$line" | awk '{print $5}' | sed 's/%//')
    mount=$(echo "$line" | awk '{print $6}')
    (( pct > max_pct )) && max_pct=$pct
    if (( pct >= crit )); then
      status="critical"
      detail="${detail:+$detail; }disk $mount at ${pct}%"
    elif (( pct >= warn && status == "ok" )); then
      status="warning"
      detail="${detail:+$detail; }disk $mount at ${pct}%"
    fi
  done < <(df --type=ext4 --type=xfs --type=btrfs --type=overlay 2>/dev/null | tail -n +2 || true)
  if [[ -z "$detail" ]]; then
    detail="all filesystems below ${warn}%"
    max_pct=$(df --output=pcent / 2>/dev/null | tail -n1 | tr -cd '0-9' || echo "0")
  fi
  printf '%s\t%s\t%s\n' "$status" "${max_pct:-0}" "${detail:-no mounts checked}"
}

check_memory() {
  local warn=$1 crit=$2
  local total used available pct status="ok" detail=""
  read -r total used available < <(free -b 2>/dev/null | awk '/^Mem:/ {print $2,$3,$7}')
  if [[ -z "$total" || "$total" -eq 0 ]]; then
    printf 'unknown\t0\t%s\n' "meminfo unavailable"
    return
  fi
  pct=$(( (used * 100) / total ))
  if (( pct >= crit )); then
    status="critical"
    detail="memory at ${pct}% used"
  elif (( pct >= warn )); then
    status="warning"
    detail="memory at ${pct}% used"
  else
    detail="memory at ${pct}% used"
  fi
  printf '%s\t%s\t%s\n' "$status" "$pct" "$detail"
}

check_containers() {
  local filter="$1"
  local running=0 stopped=0 status="ok" detail=""
  local out=""
  out=$(docker ps -a --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -E "$filter" || echo "")
  if [[ -z "$out" ]]; then
    printf 'critical\t0\tno matching containers found\n'
    return
  fi
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    name=$(echo "$line" | awk '{print $1}')
    state=$(echo "$line" | cut -d' ' -f2-)
    if [[ "$state" == Up* ]]; then
      running=$((running + 1))
    else
      stopped=$((stopped + 1))
      status="critical"
      detail="${detail:+$detail; }$name is $state"
    fi
  done <<< "$out"
  if (( stopped > 0 )); then
    :
  else
    detail="${running}/${running} running"
  fi
  printf '%s\t%s\t%s\n' "$status" "$running" "${detail:-$running/${running}}"
}

check_http_health() {
  local url="$1" token="${2:-}"
  local status="ok" code=0 detail="" raw_code=""
  local curl_args=(-s -S -o /dev/null -w '%{http_code}' --max-time 10)
  if [[ -n "$token" ]]; then
    curl_args+=(-H "x-health-check-token: $token")
  fi
  raw_code=$(curl "${curl_args[@]}" "$url" 2>/dev/null || echo "000")
  code=$(echo "$raw_code" | tr -cd '0-9' | head -c 3)
  code=${code:-0}
  if [[ "$code" == "200" ]]; then
    detail="HTTP 200"
  else
    status="critical"
    detail="HTTP ${code}"
  fi
  printf '%s\t%s\t%s\n' "$status" "$code" "$detail"
}

check_postgresql() {
  local status="ok" detail=""
  if command -v psql >/dev/null 2>&1 && [[ -f /etc/scalesmiths/monitor-database-url ]]; then
    local db_url
    db_url=$(head -n1 /etc/scalesmiths/monitor-database-url 2>/dev/null || echo "")
    if [[ -n "$db_url" ]]; then
      if PGPASSWORD="" timeout 5 psql "$db_url" -c 'SELECT 1' >/dev/null 2>&1; then
        detail="psql connection OK"
      else
        status="critical"
        detail="psql connection failed"
      fi
    else
      detail="database URL file empty"
    fi
  elif command -v docker >/dev/null 2>&1; then
    if timeout 5 docker exec postgres-16-alpine pg_isready -U ssadmin >/dev/null 2>&1; then
      detail="pg_isready via docker exec"
    else
      status="critical"
      detail="pg_isready failed or docker unavailable"
    fi
  else
    detail="psql and docker not available for PG check"
  fi
  printf '%s\t-\t%s\n' "$status" "$detail"
}

check_backup_freshness() {
  local stale_hrs=$1 backup_dir=$2
  local status="ok" age_hrs=0 newest="" detail=""
  if [[ ! -d "$backup_dir" ]]; then
    printf 'critical\t%s\t%s\n' "9999" "backup directory does not exist"
    return
  fi
  newest=$(find "$backup_dir" -maxdepth 1 -name '*.verified.json' -print -quit 2>/dev/null || echo "")
  if [[ -z "$newest" ]]; then
    printf 'critical\t%s\t%s\n' "9999" "no verified backup markers found"
    return
  fi
  local created now_epoch bundle_epoch
  created=$(jq -r '.createdAt // empty' "$newest" 2>/dev/null || echo "")
  if [[ -z "$created" ]]; then
    printf 'warning\t%s\t%s\n' "0" "backup marker has no createdAt"
    return
  fi
  now_epoch=$(date -u +%s)
  bundle_epoch=$(date -u -d "$created" +%s 2>/dev/null || echo "0")
  if (( bundle_epoch == 0 )); then
    printf 'warning\t%s\t%s\n' "0" "cannot parse backup timestamp"
    return
  fi
  age_hrs=$(( (now_epoch - bundle_epoch) / 3600 ))
  if (( age_hrs > stale_hrs )); then
    status="critical"
    detail="newest verified backup is ${age_hrs}h old (threshold ${stale_hrs}h)"
  elif (( age_hrs > stale_hrs - 6 )); then
    status="warning"
    detail="backup is ${age_hrs}h old, approaching ${stale_hrs}h threshold"
  else
    detail="backup is ${age_hrs}h old"
  fi
  printf '%s\t%s\t%s\n' "$status" "$age_hrs" "${detail:-ok}"
}

main() {
  load_config
  mkdir -p "$STATUS_DIR"
  chmod 700 "$STATUS_DIR"

  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  local ds ds_out d_pct ram ram_out r_pct cont cont_out running_c
  local web_h web_out web_code admin_h admin_out admin_code
  local pg_h pg_out bk_h bk_out bk_age

  IFS=$'\t' read -r ds d_pct ds_out < <(check_disk "$MONITOR_DISK_WARN_PCT" "$MONITOR_DISK_CRIT_PCT")
  IFS=$'\t' read -r ram r_pct ram_out < <(check_memory "$MONITOR_MEM_WARN_PCT" "$MONITOR_MEM_CRIT_PCT")
  IFS=$'\t' read -r cont running_c cont_out < <(check_containers "$MONITOR_CONTAINER_FILTER")
  IFS=$'\t' read -r web_h web_code web_out < <(check_http_health "$MONITOR_WEB_HEALTH_URL")
  IFS=$'\t' read -r admin_h admin_code admin_out < <(check_http_health "$MONITOR_ADMIN_HEALTH_URL" "$MONITOR_ADMIN_HEALTH_TOKEN")
  IFS=$'\t' read -r pg_h _ pg_out < <(check_postgresql)
  IFS=$'\t' read -r bk_h bk_age bk_out < <(check_backup_freshness "$MONITOR_BACKUP_STALE_HOURS" "$MONITOR_BACKUP_DIR")

  local overall="ok"
  local criticals=()
  for check in "$ds" "$ram" "$cont" "$web_h" "$admin_h" "$pg_h" "$bk_h"; do
    if [[ "$check" == "critical" ]]; then
      overall="critical"
      break
    elif [[ "$check" == "warning" && "$overall" == "ok" ]]; then
      overall="warning"
    fi
  done

  if [[ "$overall" == "critical" ]]; then
    criticals=()
    [[ "$ds" == "critical" ]] && criticals+=("disk: $ds_out")
    [[ "$ram" == "critical" ]] && criticals+=("memory: $ram_out")
    [[ "$cont" == "critical" ]] && criticals+=("containers: $cont_out")
    [[ "$web_h" == "critical" ]] && criticals+=("web app: $web_out")
    [[ "$admin_h" == "critical" ]] && criticals+=("admin app: $admin_out")
    [[ "$pg_h" == "critical" ]] && criticals+=("postgresql: $pg_out")
    [[ "$bk_h" == "critical" ]] && criticals+=("backup: $bk_out")
    local detail_str
    detail_str=$(printf '%s; ' "${criticals[@]}")
    detail_str="${detail_str%; }"
    notify "scalesmiths-monitor-critical" "$detail_str"
  fi

  jq -nc --arg ts "$timestamp" --arg overall "$overall" \
    --arg disk "$ds" --arg diskPct "$d_pct" --arg diskDetail "$ds_out" \
    --arg memory "$ram" --arg memPct "$r_pct" --arg memDetail "$ram_out" \
    --arg containers "$cont" --argjson containersRunning "$running_c" --arg contDetail "$cont_out" \
    --arg webHealth "$web_h" --arg webCode "$web_code" --arg webDetail "$web_out" \
    --arg adminHealth "$admin_h" --arg adminCode "$admin_code" --arg adminDetail "$admin_out" \
    --arg postgresql "$pg_h" --arg pgDetail "$pg_out" \
    --arg backup "$bk_h" --argjson backupAgeHrs "$bk_age" --arg backupDetail "$bk_out" \
    '{
      timestamp: $ts,
      overall: $overall,
      disk: { status: $disk, usagePct: ($diskPct|tonumber), detail: $diskDetail },
      memory: { status: $memory, usagePct: ($memPct|tonumber), detail: $memDetail },
      containers: { status: $containers, running: $containersRunning, detail: $contDetail },
      web: { status: $webHealth, httpCode: ($webCode|tonumber), detail: $webDetail },
      admin: { status: $adminHealth, httpCode: ($adminCode|tonumber), detail: $adminDetail },
      postgresql: { status: $postgresql, detail: $pgDetail },
      backup: { status: $backup, ageHours: $backupAgeHrs, detail: $backupDetail }
    }' > "$STATUS_FILE.tmp"
  mv "$STATUS_FILE.tmp" "$STATUS_FILE"
  chmod 600 "$STATUS_FILE"

  if [[ "$overall" == "critical" ]]; then
    echo "[$timestamp] CRITICAL — see $STATUS_FILE" >&2
    exit 1
  elif [[ "$overall" == "warning" ]]; then
    echo "[$timestamp] WARNING — see $STATUS_FILE" >&2
    exit 0
  fi
  exit 0
}

main "$@"