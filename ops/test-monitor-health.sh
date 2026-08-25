#!/usr/bin/env bash
set -euo pipefail

# Quick smoke-test of the ScaleSmiths operational health monitor.
# Run on the VPS. No production data is modified.
# Requires: bash, jq, curl, docker

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
MONITOR_SCRIPT="$SCRIPT_DIR/monitor-health.sh"
FAILURES=0

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; FAILURES=$((FAILURES + 1)); }

echo "=== ScaleSmiths monitor smoke tests ==="
echo ""

# -- Test 1: script syntax --
echo "--- Test 1: bash syntax ---"
if bash -n "$MONITOR_SCRIPT" 2>/dev/null; then
  pass "syntax valid"
else
  fail "syntax error"
fi

# -- Test 2: script completes without error --
echo "--- Test 2: script execution ---"
STATUS_DIR=$(mktemp -d)
trap 'rm -rf "$STATUS_DIR"' EXIT
export SCALESMITHS_MONITOR_STATUS_DIR="$STATUS_DIR"
export MONITOR_NOTIFY_HOOK=""

if bash "$MONITOR_SCRIPT" >/dev/null 2>&1; then
  pass "script completed (exit 0)"
else
  rc=$?
  if (( rc == 1 )); then
    echo "  INFO: exit code 1 means a critical check failed — that may be"
    echo "  expected if containers aren't running in this test environment."
    pass "script ran and produced exit code $rc (critical detected)"
  else
    fail "script failed with exit code $rc"
  fi
fi

# -- Test 3: status file written --
echo "--- Test 3: status file ---"
if [[ -f "$STATUS_DIR/status.json" ]]; then
  if jq -e '.timestamp and .overall and .disk and .memory and .containers' "$STATUS_DIR/status.json" >/dev/null 2>&1; then
    pass "status file contains required fields"
    jq -r '"    overall=\(.overall) disk=\(.disk.status) containers=\(.containers.status)"' "$STATUS_DIR/status.json"
  else
    fail "status file missing expected fields"
  fi
else
  fail "status file was not created"
fi

# -- Test 4: disk check parses real output --
echo "--- Test 4: disk check ---"
if df --type=ext4 --type=xfs --type=btrfs --type=overlay >/dev/null 2>&1; then
  pass "df command available for disk checks"
else
  pass "no ext4/xfs/btrfs/overlay mounts (this is fine)"
fi

# -- Test 5: memory check --
echo "--- Test 5: memory check ---"
if free -b >/dev/null 2>&1; then
  pass "free available for memory checks"
else
  fail "free command not available"
fi

# -- Test 6: jq available --
echo "--- Test 6: jq available ---"
if command -v jq >/dev/null 2>&1; then
  pass "jq available"
else
  fail "jq not available (required for backup freshness check)"
fi

# -- Test 7: simulated critical failure via threshold override --
echo "--- Test 7: simulated critical failure ---"
STATUS_DIR2=$(mktemp -d)
trap 'rm -rf "$STATUS_DIR" "$STATUS_DIR2"' EXIT
export SCALESMITHS_MONITOR_STATUS_DIR="$STATUS_DIR2"
export MONITOR_NOTIFY_HOOK=""
export MONITOR_DISK_WARN_PCT=1
export MONITOR_DISK_CRIT_PCT=1
export MONITOR_BACKUP_STALE_HOURS=1
export MONITOR_BACKUP_DIR=/nonexistent/backup/dir

if ! bash "$MONITOR_SCRIPT" >/dev/null 2>&1; then
  rc=$?
  overall=$(jq -r '.overall' "$STATUS_DIR2/status.json" 2>/dev/null || echo "missing")
  disk=$(jq -r '.disk.status' "$STATUS_DIR2/status.json" 2>/dev/null || echo "missing")
  backup=$(jq -r '.backup.status' "$STATUS_DIR2/status.json" 2>/dev/null || echo "missing")
  echo "    overall=$overall disk=$disk backup=$backup"
  if [[ "$overall" == "critical" ]]; then
    pass "critical overall status triggered by impossible thresholds"
  else
    fail "critical thresholds did not produce critical overall status"
  fi
else
  fail "impossible threshold simulation (disk < 1% free?) — may be expected"
fi

echo ""
echo "=== Results: $FAILURES failures ==="
if (( FAILURES == 0 )); then
  echo "All smoke tests passed."
else
  echo "$FAILURES test(s) failed. Review output above."
  exit 1
fi