#!/usr/bin/env bash
# MC-C: real PostgreSQL transactions, synthetic Auth scaffolding, no remote access.
# Only the uniquely named container created here is removed. No host data volume/port.
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
image="postgres:17.10-alpine"
container="ecodis-mcc-test-$(date +%s)-$$"
created=0
logs="$(mktemp -d -t ecodis-mcc-XXXXXX)"
cleanup() {
  if [ "$created" -eq 1 ]; then docker rm -f "$container" >/dev/null; fi
  printf 'Test logs: %s\n' "$logs"
}
trap cleanup EXIT
docker image inspect "$image" >/dev/null
docker run --detach --name "$container" --label ecodis.test=mc-c --network none \
  --tmpfs /var/lib/postgresql/data -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
created=1
ready=0
for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || { docker logs "$container"; exit 1; }
sql() { docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
sql < supabase/tests/moderation/bootstrap.sql > "$logs/bootstrap.log"
migration="supabase/migrations/20261014194235_phase4_moderation_integrity.sql"
for path in supabase/migrations/*.sql; do
  if [ "$path" = "$migration" ]; then
    sql < supabase/tests/moderation/fixtures.sql > "$logs/fixtures.log"
  fi
  printf 'Applying %s\n' "$path"
  if ! sql < "$path" > "$logs/$(basename "$path").log" 2>&1; then
    cat "$logs/$(basename "$path").log"; exit 1
  fi
done
if ! sql < supabase/tests/moderation/integrity.sql > "$logs/integrity.log" 2>&1; then
  cat "$logs/integrity.log"; exit 1
fi
printf 'PASS: SQL integrity and legacy-data upgrade\n'

author="00000000-0000-0000-0000-000000000001"
moderator="00000000-0000-0000-0000-000000000002"
reporter="00000000-0000-0000-0000-000000000003"
sql -c 'create table public.mcc_test_gate(released boolean not null); insert into public.mcc_test_gate values(false); grant select on public.mcc_test_gate to service_role;' > "$logs/gate.log"
# A holds the comment lock inside its real transaction. Observe pg_sleep before B
# starts, so scheduling speed does not turn the concurrency test into a serial one.
race() {
  local name="$1" holder="$2" contender="$3" expected="$4"
  sql -c 'update public.mcc_test_gate set released=false' >/dev/null
  sql -c "set application_name='mcc-holder'; begin; set local role service_role; $holder; do \$gate\$ declare started timestamptz := clock_timestamp(); begin loop exit when (select released from public.mcc_test_gate); if clock_timestamp()-started > interval '60 seconds' then raise exception 'Gate timeout'; end if; perform pg_sleep(0.1); end loop; end \$gate\$; commit;" > "$logs/$name-holder.log" 2>&1 &
  local holder_pid=$!
  local seen=0
  for attempt in $(seq 1 30); do
    if [ "$(sql -Atc "select count(*) from pg_stat_activity where application_name='mcc-holder' and wait_event='PgSleep'")" = 1 ]; then seen=1; break; fi
    sleep 0.1
  done
  [ "$seen" -eq 1 ] || { wait "$holder_pid" || true; cat "$logs/$name-holder.log"; return 1; }
  local result=0 blocked=0
  sql --set=VERBOSITY=verbose -c "set application_name='mcc-contender'; set lock_timeout='30s'; set role service_role; $contender;" > "$logs/$name-contender.log" 2>&1 &
  local contender_pid=$!
  for attempt in $(seq 1 30); do
    if [ "$(sql -Atc "select count(*) from pg_stat_activity where application_name='mcc-contender' and wait_event_type='Lock'")" = 1 ]; then blocked=1; break; fi
    sleep 0.1
  done
  sql -c 'update public.mcc_test_gate set released=true' >/dev/null
  wait "$holder_pid"
  wait "$contender_pid" || result=$?
  [ "$blocked" -eq 1 ] || { printf 'FAIL: no overlapping lock wait observed\n'; cat "$logs/$name-contender.log"; return 1; }
  if [ "$expected" = conflict ]; then
    [ "$result" -ne 0 ] && grep -q PT409 "$logs/$name-contender.log" || { cat "$logs/$name-contender.log"; return 1; }
  else
    [ "$result" -eq 0 ] || { cat "$logs/$name-contender.log"; return 1; }
  fi
  printf 'PASS: concurrency %s\n' "$name"
}
cid="20000000-0000-0000-0000-000000000010"
race competing-decisions \
  "select public.moderate_comment_transaction('$cid','$moderator','hide',1,'test')" \
  "select public.moderate_comment_transaction('$cid','$moderator','delete',1,'test')" conflict
race author-delete-vs-restore \
  "select public.moderate_comment_transaction('$cid','$author','author_delete',2)" \
  "select public.moderate_comment_transaction('$cid','$moderator','restore',2)" conflict
[ "$(sql -Atc "select status || ':' || version from public.comments where id='$cid'")" = deleted_by_author:3 ]
cid="20000000-0000-0000-0000-000000000011"
race deletion-before-report \
  "select public.moderate_comment_transaction('$cid','$author','author_delete',1)" \
  "select public.create_comment_report_transaction('$cid','$reporter','spam')" conflict
[ "$(sql -Atc "select count(*) from public.comment_reports where comment_id='$cid'")" = 0 ]
cid="20000000-0000-0000-0000-000000000012"
race report-before-deletion \
  "select public.create_comment_report_transaction('$cid','$reporter','spam')" \
  "select public.moderate_comment_transaction('$cid','$author','author_delete',1)" success
[ "$(sql -Atc "select status || ':' || version from public.comment_reports where comment_id='$cid'")" = resolved:2 ]
printf 'PASS: MC-C PostgreSQL gate (synthetic Auth; Supabase/API gate remains MC-D/MC-F)\n'
