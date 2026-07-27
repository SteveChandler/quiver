#!/usr/bin/env bash
set -euo pipefail

source_url="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$source_url" in
  postgresql://*@127.0.0.1:*/*|postgresql://*@localhost:*/*) ;;
  *)
    echo "Refusing to create a disposable community restoration database on a non-local host." >&2
    exit 2
    ;;
esac

if [[ "$source_url" == *"?"* ]]; then
  echo "Local source URL must not contain query parameters." >&2
  exit 2
fi

smoke_db="community_legacy_restoration_smoke_$$"
smoke_url="${source_url%/*}/${smoke_db}"

cleanup() {
  psql "$source_url" -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$smoke_db\" WITH (FORCE);" >/dev/null
}
trap cleanup EXIT

psql "$source_url" -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$smoke_db\";" >/dev/null
psql "$smoke_url" -v ON_ERROR_STOP=1 \
  -f supabase/tests/community_legacy_policy_restoration_integration.sql

echo "Community legacy policy restoration disposable database smoke passed."
