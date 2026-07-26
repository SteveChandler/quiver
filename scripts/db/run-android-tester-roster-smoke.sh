#!/usr/bin/env bash
set -euo pipefail

source_url="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$source_url" in
  postgresql://*@127.0.0.1:*/*|postgresql://*@localhost:*/*) ;;
  *)
    echo "Refusing to create a disposable smoke database on a non-local host." >&2
    exit 2
    ;;
esac

if [[ "$source_url" == *"?"* ]]; then
  echo "Local source URL must not contain query parameters." >&2
  exit 2
fi

smoke_db="android_tester_roster_smoke_$$"
smoke_url="${source_url%/*}/${smoke_db}"
claims_dir="$(mktemp -d)"

cleanup() {
  psql "$source_url" -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$smoke_db\" WITH (FORCE);" >/dev/null
  case "$claims_dir" in
    /tmp/*|/private/tmp/*|/var/folders/*/T/tmp.*) rm -r "$claims_dir" ;;
  esac
}
trap cleanup EXIT

psql "$source_url" -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$smoke_db\";" >/dev/null
psql "$smoke_url" -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (
        id uuid PRIMARY KEY,
        email text
      );
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        deleted_at timestamptz
      );" \
  >/dev/null
psql "$smoke_url" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260725213000_create_android_tester_roster.sql \
  >/dev/null

pids=()
for worker in 1 2 3 4 5 6; do
  psql "$smoke_url" -At -v ON_ERROR_STOP=1 \
    -c "SELECT public.claim_android_tester_roster_sync(NULL, now());" \
    >"$claims_dir/claim-$worker" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do
  wait "$pid"
done

claim_count=0
claim_token=""
for claim_file in "$claims_dir"/claim-*; do
  candidate="$(tr -d '[:space:]' <"$claim_file")"
  if [[ -n "$candidate" ]]; then
    claim_count=$((claim_count + 1))
    claim_token="$candidate"
  fi
done

if [[ "$claim_count" -ne 1 ]]; then
  echo "Expected exactly one concurrent sync claim, got $claim_count." >&2
  exit 1
fi

psql "$smoke_url" -At -v ON_ERROR_STOP=1 \
  -c "SELECT public.release_android_tester_roster_sync_claim('$claim_token');" \
  | grep -qx "t"

psql "$smoke_url" -v ON_ERROR_STOP=1 \
  -f scripts/db/android-tester-roster-smoke.sql

echo "Android tester roster disposable database smoke passed."
