#!/usr/bin/env bash
set -euo pipefail
scout_root="$(cd "$(dirname "$0")/.." && pwd)"
scout_container="week-scout-paging-test-$$"
scout_image=public.ecr.aws/supabase/postgres:15.8.1.085
cleanup() { docker rm -f "$scout_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# A new cluster, no published port, volumes, env files or existing database.
docker run --rm -d --name "$scout_container" --user postgres --entrypoint bash "$scout_image" -c \
  'initdb -D /tmp/scout-pg --auth=trust >/dev/null && exec postgres -D /tmp/scout-pg -c listen_addresses="" -c unix_socket_directories=/tmp' >/dev/null
deadline=$((SECONDS + 30))
until docker exec "$scout_container" pg_isready -U postgres -h /tmp >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then docker logs "$scout_container"; exit 1; fi
  sleep 0.1
done
for file in \
  __tests__/fixtures/week-scout-paging-base.sql \
  supabase/migrations/20260904120000_add_weekend_scout_candidate_paging.sql \
  __tests__/fixtures/week-scout-paging-probe.sql; do
  docker exec -i "$scout_container" psql -X -h /tmp -U postgres -v ON_ERROR_STOP=1 -f - < "$scout_root/$file"
done
docker image inspect "$scout_image" --format 'Database image: {{.Id}}'
