#!/usr/bin/env bash
# Disposable local cluster only; concurrency is coordinated by PostgreSQL lock state.
set -euo pipefail
claim_root="$(cd "$(dirname "$0")/.." && pwd)"
claim_pg_bin="${SCOUT_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 TMPDIR=/tmp
claim_tmp="$(mktemp -d /tmp/quiver-first-sighting-test.XXXXXX)"
cleanup() {
  "$claim_pg_bin/pg_ctl" -D "$claim_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$claim_tmp"
}
trap cleanup EXIT
"$claim_pg_bin/initdb" -D "$claim_tmp/data" -A trust --no-locale >/dev/null
"$claim_pg_bin/pg_ctl" -D "$claim_tmp/data" -l "$claim_tmp/postgres.log" -o "-k $claim_tmp -c listen_addresses=''" -w start >/dev/null
python3 - "$claim_pg_bin/psql" "$claim_tmp" "$(id -un)" "$claim_root" <<'PY'
import json
import subprocess
import sys
import time
from pathlib import Path

psql, socket, owner, root = sys.argv[1:]
command = [psql, '-X', '-qAt', '-h', socket, '-p', '5432', '-U', owner, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']

def query(sql):
    return subprocess.run(command + ['-c', sql], check=True, text=True, capture_output=True, timeout=15).stdout.strip()

query('''CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE profiles (id uuid PRIMARY KEY);
CREATE TABLE beaches (id uuid PRIMARY KEY);
CREATE TABLE swell_event_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(id),
  event_key text NOT NULL, peak_date date NOT NULL, lead_beach_id uuid NOT NULL REFERENCES beaches(id),
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, event_key));
INSERT INTO profiles VALUES ('73040cff-afe9-4fa0-a874-2016203fc015'), ('73040cff-afe9-4fa0-a874-2016203fc016');
INSERT INTO beaches VALUES ('ffffffff-0000-4000-8000-000000000001');''')
migration = Path(root, 'supabase/migrations/20261004220000_claim_swell_outlook_first_sighting.sql').read_text()
query(migration)
query(migration)
function = 'claim_swell_outlook_first_sighting(uuid,text,text[],date,uuid,jsonb,timestamp with time zone)'
for role in ['anon', 'authenticated']:
    assert query(f"SELECT has_function_privilege('{role}', '{function}', 'EXECUTE')") == 'f'
    denied = subprocess.run(command + ['-c', f'SET ROLE {role}; SELECT claim_swell_outlook_first_sighting(NULL,NULL,NULL,NULL,NULL,NULL,NULL);'], text=True, capture_output=True)
    assert denied.returncode != 0 and 'permission denied for function' in denied.stderr
assert query(f"SELECT has_function_privilege('service_role', '{function}', 'EXECUTE')") == 't'

user = '73040cff-afe9-4fa0-a874-2016203fc015'
other = '73040cff-afe9-4fa0-a874-2016203fc016'
beach = 'ffffffff-0000-4000-8000-000000000001'

def claim(key, at='2026-09-18T17:00:00Z', recipient=user, aliases=None):
    aliases = aliases or [key]
    array = ','.join("'" + alias + "'" for alias in aliases)
    return f"SELECT claim_swell_outlook_first_sighting('{recipient}', '{key}', ARRAY[{array}], '2026-09-21', '{beach}', '{{}}', '{at}')"

def race(first_key, second_key, second_user=user):
    first = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    second = None
    try:
        first.stdin.write('BEGIN; SET ROLE service_role; ' + claim(first_key) + ';\n')
        first.stdin.flush()
        assert json.loads(first.stdout.readline())['id'], 'first claim failed'
        second = subprocess.Popen(command + ['-c', 'SET ROLE service_role; ' + claim(second_key, recipient=second_user)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        deadline = time.monotonic() + 10
        while query("SELECT count(*) FROM pg_stat_activity WHERE wait_event = 'advisory'") != '1':
            assert time.monotonic() < deadline, 'second claim did not wait for the per-user lock'
            assert second.poll() is None, 'second claim bypassed the per-user lock'
        first.stdin.write('COMMIT;\n')
        first.stdin.flush()
        first.stdin.close()
        assert first.wait(timeout=10) == 0
        result, error = second.communicate(timeout=10)
        assert second.returncode == 0, error
        denied = json.loads(result)
        expected_reason = 'event_exists' if first_key == second_key else 'first_sighting_spacing'
        assert denied == {'id': None, 'reason': expected_reason}, 'overlapping claim returned the wrong reason'
    finally:
        for process in [first, second]:
            if process is not None and process.poll() is None:
                process.kill()
                process.wait()

race('same', 'same')
assert query('SELECT count(*) FROM swell_event_alerts') == '1'
query('TRUNCATE swell_event_alerts')
race('first', 'different')
assert query('SELECT count(*) FROM swell_event_alerts') == '1'
assert json.loads(query('SET ROLE service_role; ' + claim('other-user', recipient=other)))['id'], 'another user was blocked'
within = query("BEGIN; UPDATE swell_event_alerts SET created_at=now()-interval '72 hours'+interval '1 microsecond' WHERE user_id='" + user + "'; SET ROLE service_role; " + claim('within') + "; ROLLBACK")
assert json.loads(within) == {'id': None, 'reason': 'first_sighting_spacing'}
boundary = query("BEGIN; UPDATE swell_event_alerts SET created_at=now()-interval '72 hours' WHERE user_id='" + user + "'; SET ROLE service_role; " + claim('boundary') + "; COMMIT")
assert json.loads(boundary)['id'], 'exact 72-hour boundary blocked'
query("UPDATE swell_event_alerts SET created_at=now()-interval '96 hours' WHERE user_id='" + user + "'")
for key, aliases in [('renamed', ['first']), ('first', ['first'])]:
    assert json.loads(query('SET ROLE service_role; ' + claim(key, aliases=aliases))) == {'id': None, 'reason': 'event_exists'}
for supplied_clock in ['1970-01-01T00:00:00Z', '2999-01-01T00:00:00Z']:
    query('TRUNCATE swell_event_alerts')
    result = query('BEGIN; SET ROLE service_role; ' + claim('clock', at=supplied_clock)
        + "; RESET ROLE; SELECT created_at=now() FROM swell_event_alerts WHERE event_key='clock'; COMMIT").splitlines()
    assert json.loads(result[0])['id'] and result[1] == 't', 'caller clock affected created_at'
    assert json.loads(query('SET ROLE service_role; ' + claim('clock-second', at=supplied_clock))) == {
        'id': None, 'reason': 'first_sighting_spacing'}, 'caller clock affected spacing'
print('PASS: repeat migration, service-role isolation, same/different-event concurrency with distinct reasons, other-user independence, exact 72-hour boundary, aliases, permanent event dedupe, database clock with far-past/future callers')
PY
