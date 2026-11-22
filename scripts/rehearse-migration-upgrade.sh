#!/usr/bin/env bash
# Project Aegis (B1.7): production-equivalent migration UPGRADE rehearsal on a disposable PostgreSQL server.
#
#   1. Checks out the previously deployed release (BASELINE_REF) in a temporary worktree.
#   2. Provisions the restricted roles and applies that release's migrations with that release's own tooling.
#   3. Populates realistic data by running that release's own real-PostgreSQL suites (commission ledger, contracts,
#      historical plans, drafts, immutable content versions, audit rows), exactly as that code wrote it.
#   4. Fingerprints every pre-existing row (pre-upgrade column list only), then applies the CURRENT migrations with the
#      current tooling, re-provisions and re-verifies the restricted roles.
#   5. Re-fingerprints the same rows, and diffs the upgraded schema against a fresh install of the current history.
#
# Disposable-only: refuses anything but a loopback host, port 55440 and database ss_expansion_test (the name and port the
# real-PostgreSQL suites' own safety guards accept). It never reads production, never edits a committed migration, and
# writes evidence (no secrets, synthetic data only) to REHEARSAL_EVIDENCE_DIR.
#
# Usage (from the repository root, with web/ and admin/ dependencies installed):
#   REHEARSAL_SUPERUSER_URL=postgresql://<superuser>:<pw>@127.0.0.1:55440/ss_expansion_test \
#   BASELINE_REF=37995d2 REHEARSAL_EVIDENCE_DIR=/tmp/rehearsal bash scripts/rehearse-migration-upgrade.sh
set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SUPER="${REHEARSAL_SUPERUSER_URL:?REHEARSAL_SUPERUSER_URL is required}"
BASELINE_REF="${BASELINE_REF:?BASELINE_REF (the previously deployed release) is required}"
OUT="${REHEARSAL_EVIDENCE_DIR:?REHEARSAL_EVIDENCE_DIR is required}"
DB_NAME=ss_expansion_test FRESH_DB=ss_rehearsal_fresh_test

# libpq also reads its target from the environment (PGHOSTADDR overrides the URL's host); none of it may steer this script.
unset PGHOST PGHOSTADDR PGPORT PGDATABASE PGSERVICE PGSERVICEFILE PGSSLMODE PGPASSFILE PGOPTIONS
node -e '
const u = new URL(process.argv[1]);
// libpq and node-pg let ?host=/?port=/?dbname= override the authority, so any query string or fragment is refused.
if (u.hostname !== "127.0.0.1" || u.port !== "55440" || u.pathname !== "/ss_expansion_test" || u.search || u.hash) {
  console.error("Refusing: the rehearsal runs only against a disposable loopback server at 127.0.0.1:55440, database ss_expansion_test."); process.exit(2) }
' "$SUPER"

mkdir -p "$OUT"
url_for() { node -e 'const u=new URL(process.argv[1]); u.username=process.argv[2]; u.password=process.argv[3]; u.pathname="/"+process.argv[4]; console.log(u.toString())' "$SUPER" "$1" "$2" "$3"; }
set_role_urls() {
  export POSTGRES_PROVISIONING_DATABASE_URL; POSTGRES_PROVISIONING_DATABASE_URL="$(node -e 'const u=new URL(process.argv[1]); u.pathname="/"+process.argv[2]; console.log(u.toString())' "$SUPER" "$1")"
  export MIGRATION_DATABASE_URL; MIGRATION_DATABASE_URL="$(url_for scalesmiths_expansion_migration local_ci_only_migration "$1")"
  export ADMIN_DATABASE_URL; ADMIN_DATABASE_URL="$(url_for scalesmiths_expansion_admin local_ci_only_admin "$1")"
  export WEB_DATABASE_URL; WEB_DATABASE_URL="$(url_for scalesmiths_expansion_web local_ci_only_web "$1")"
}
migrate_with() { # <admin dir> <database>
  set_role_urls "$2"
  (cd "$1" && node scripts/provision-postgres-roles.mjs --confirm-provision && node scripts/migrate-shared-test-database.mjs \
    && node scripts/provision-postgres-roles.mjs --confirm-provision && node scripts/verify-postgres-privileges.mjs)
}
fingerprint() { # <database url> <columns json> <journal max-id json> -> per-table row fingerprints over the given (pre-upgrade) columns
  psql "$1" -X -At -v ON_ERROR_STOP=1 <<SQL
with cols as (select key tbl, value c from jsonb_each('$(cat "$2")'::jsonb))
-- Migration journals are append-only by design: fingerprint only the rows that existed before the upgrade (id <= the
-- pre-upgrade maximum recorded in $3); every other table is fingerprinted whole.
, scope as (select tbl, c, case when tbl like 'drizzle.%' then format(' where id <= %s', coalesce(('$(cat "$3")'::jsonb)->>tbl, '0')) else '' end w from cols)
select tbl || ' ' || (xpath('/row/h/text()', query_to_xml(format(
  'select md5(coalesce(string_agg(t::text, %L order by t::text), %L)) h from (select %s from %s%s) t', '|', '',
  (select string_agg(quote_ident(x), ',') from jsonb_array_elements_text(c) x), tbl, w), false, true, '')))[1]::text
  || ' rows=' || (xpath('/row/n/text()', query_to_xml(format('select count(*) n from %s%s', tbl, w), false, true, '')))[1]::text
from scope order by tbl;
SQL
}

WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/aegis-baseline.XXXXXX")"
cleanup() { git -C "$ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true; }
trap cleanup EXIT
git -C "$ROOT" worktree add --detach "$WORKTREE" "$BASELINE_REF" >/dev/null
# The baseline reuses the current dependencies; that is sound only while the migrator stack is unchanged, so it is checked.
for app in admin web; do for pkg in drizzle-orm drizzle-kit pg; do
  [[ "$(git -C "$WORKTREE" show HEAD:$app/package-lock.json | jq -r ".packages[\"node_modules/$pkg\"].version")" == "$(jq -r ".packages[\"node_modules/$pkg\"].version" "$ROOT/$app/package-lock.json")" ]] \
    || { echo "Refusing: $app $pkg differs between the baseline and the current tree; install the baseline's own dependencies."; exit 2; }
done; done
ln -s "$ROOT/admin/node_modules" "$WORKTREE/admin/node_modules"; ln -s "$ROOT/web/node_modules" "$WORKTREE/web/node_modules"
BASE_SHA="$(git -C "$WORKTREE" rev-parse HEAD)"; HEAD_SHA="$(git -C "$ROOT" rev-parse HEAD)"
echo "baseline=$BASE_SHA head=$HEAD_SHA server=$(psql "$SUPER" -XAtc 'show server_version')" | tee "$OUT/rehearsal-identity.txt"

[[ "$(psql "$SUPER" -XAt -c "select count(*) from pg_tables where schemaname in ('public','drizzle')")" == 0 ]] \
  || { echo "Refusing: $DB_NAME is not empty; start from a freshly created disposable server."; exit 2; }
echo "== 1. Baseline schema with the baseline release's own tooling"
migrate_with "$WORKTREE/admin" "$DB_NAME" 2>&1 | tee "$OUT/1-baseline-migrate.log" | tail -n 3

echo "== 2. Realistic data written by the baseline release's own real-PostgreSQL suites"
set_role_urls "$DB_NAME"
(cd "$WORKTREE/admin" && EXPANSION_TEST_DATABASE_URL="$ADMIN_DATABASE_URL" EXPANSION_WEB_TEST_DATABASE_URL="$WEB_DATABASE_URL" \
  npx vitest run --config vitest.integration.config.ts test/integration/expansion-concurrency.integration.test.ts \
  test/integration/empower-content.integration.test.ts test/integration/empower-academy.integration.test.ts \
  test/integration/empower-resources.integration.test.ts test/integration/empower-knowledge.integration.test.ts) 2>&1 \
  | sed -E 's/\x1b\[[0-9;]*m//g' > "$OUT/2-baseline-data.log" || { echo "Baseline data suites failed; the baseline would be under-populated."; tail -n 30 "$OUT/2-baseline-data.log"; exit 1; }
grep -E "Test Files|Tests " "$OUT/2-baseline-data.log"

echo "== 3. Fingerprint every pre-existing row over the pre-upgrade column list"
psql "$SUPER" -X -At -v ON_ERROR_STOP=1 -c "select jsonb_object_agg(format('%I.%I', table_schema, table_name), cols) from (
  select table_schema, table_name, jsonb_agg(column_name order by ordinal_position) cols from information_schema.columns
  where table_schema in ('public','drizzle') and (table_schema, table_name) in (select table_schema, table_name from information_schema.tables where table_type='BASE TABLE')
  group by 1,2) t" > "$OUT/3-pre-upgrade-columns.json"
psql "$SUPER" -X -At -v ON_ERROR_STOP=1 -c "select jsonb_build_object('drizzle.__drizzle_migrations', (select max(id) from drizzle.__drizzle_migrations), 'drizzle.__drizzle_web_migrations', (select max(id) from drizzle.__drizzle_web_migrations))" > "$OUT/3-journal-max-ids.json"
fingerprint "$SUPER" "$OUT/3-pre-upgrade-columns.json" "$OUT/3-journal-max-ids.json" > "$OUT/3-before.txt"
echo "$(wc -l < "$OUT/3-before.txt") tables fingerprinted; $(awk -F'rows=' '{s+=$2} END {print s}' "$OUT/3-before.txt") rows"

echo "== 4. Upgrade to the current history with the current tooling"
migrate_with "$ROOT/admin" "$DB_NAME" 2>&1 | tee "$OUT/4-upgrade-migrate.log" | tail -n 3

echo "== 5. Every pre-existing row is unchanged"
fingerprint "$SUPER" "$OUT/3-pre-upgrade-columns.json" "$OUT/3-journal-max-ids.json" > "$OUT/5-after.txt"
psql "$SUPER" -X -At -c "select 'appended journal entries: admin ' || (select count(*) from drizzle.__drizzle_migrations where id > ($(jq '."drizzle.__drizzle_migrations"' "$OUT/3-journal-max-ids.json"))) || ', web ' || (select count(*) from drizzle.__drizzle_web_migrations where id > ($(jq '."drizzle.__drizzle_web_migrations"' "$OUT/3-journal-max-ids.json")))" | tee "$OUT/5-appended.txt"
grep -qE "admin [1-9][0-9]*, web [0-9]+" "$OUT/5-appended.txt" || { echo "Nothing was upgraded: the baseline already matched the current history."; exit 1; }
if diff -u "$OUT/3-before.txt" "$OUT/5-after.txt" > "$OUT/5-row-diff.txt"; then echo "rows: identical"; else echo "ROWS CHANGED:"; cat "$OUT/5-row-diff.txt"; exit 1; fi

echo "== 6. Upgraded schema equals a fresh install of the current history"
psql "$SUPER" -X -q -c "drop database if exists $FRESH_DB" -c "create database $FRESH_DB"
migrate_with "$ROOT/admin" "$FRESH_DB" > "$OUT/6-fresh-migrate.log" 2>&1
# Some sandboxed PostgreSQL runtimes stamp every column with a random `pg_attver` attribute option (observed on a plain
# `create table` with no migration involved); it is not schema the repository creates, so exactly that line shape is dropped.
dump() { pg_dump --schema-only --no-owner --no-privileges "$1" | grep -vE '^(--|SET |SELECT pg_catalog|\\restrict|\\unrestrict)' \
  | grep -vE '^ALTER TABLE ONLY [A-Za-z0-9_."]+ ALTER COLUMN [A-Za-z0-9_"]+ SET \(pg_attver=[0-9]+\);$' | sed '/^$/d'; }
dump "$SUPER" > "$OUT/6-upgraded-schema.sql"
dump "$(node -e 'const u=new URL(process.argv[1]); u.pathname="/'"$FRESH_DB"'"; console.log(u.toString())' "$SUPER")" > "$OUT/6-fresh-schema.sql"
(cd "$OUT" && sha256sum 6-fresh-schema.sql 6-upgraded-schema.sql) > "$OUT/6-schema-comparison.txt"
if diff -u "$OUT/6-fresh-schema.sql" "$OUT/6-upgraded-schema.sql" > "$OUT/6-schema-diff.txt"; then echo "schema: identical ($(wc -l < "$OUT/6-fresh-schema.sql") lines)"; else echo "SCHEMA DIFFERS:"; head -50 "$OUT/6-schema-diff.txt"; exit 1; fi
psql "$SUPER" -X -At -c "select 'web='||(select count(*) from drizzle.__drizzle_web_migrations)||' admin='||(select count(*) from drizzle.__drizzle_migrations)" | tee "$OUT/6-journal-counts.txt"
echo "Upgrade rehearsal passed. Evidence: $OUT"
