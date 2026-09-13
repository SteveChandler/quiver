"""Run the actual camera migration against local Supabase, then roll back."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[3]
selected = json.loads(Path(__file__).with_name('selected-cameras.json').read_text())
assert len(selected) == 7
assert len({row['beach_id'] for row in selected}) == 7
migration = (root / 'supabase/migrations/20260903190000_add_verified_provider_cameras.sql').read_text()
assert '\nBEGIN;\n' in migration and migration.endswith('COMMIT;\n')
body = migration.replace('\nBEGIN;\n', '\n').removesuffix('COMMIT;\n')

def quote(value):
    return "'" + value.replace("'", "''") + "'"

ids = ','.join(quote(row['beach_id']) for row in selected)
expected = ','.join('(' + quote(row['beach_id']) + '::uuid,' + quote(row['camera_url']) + ')' for row in selected)
sql = f'''BEGIN;
CREATE TEMP TABLE expected (beach_id uuid, camera_url text) ON COMMIT DROP;
INSERT INTO expected VALUES {expected};
DO $$ BEGIN
 IF (SELECT count(*) FROM beaches WHERE id IN ({ids})) <> 7 THEN
 RAISE EXCEPTION 'local catalog missing selected beaches'; END IF;
END $$;
UPDATE beach_sources SET camera_url = NULL WHERE beach_id IN ({ids});
CREATE TEMP TABLE source_before ON COMMIT DROP AS SELECT * FROM beach_sources;
{body}
{body}
DO $$ BEGIN
 IF (SELECT count(*) FROM expected e JOIN beach_sources s USING (beach_id) WHERE s.camera_url = e.camera_url) <> 7 THEN
 RAISE EXCEPTION 'migration failed to populate all seven exact cameras'; END IF;
 IF EXISTS (SELECT 1 FROM source_before b JOIN beach_sources s USING (beach_id)
 WHERE (to_jsonb(b) - 'camera_url') IS DISTINCT FROM (to_jsonb(s) - 'camera_url')) THEN
 RAISE EXCEPTION 'migration changed unrelated source settings'; END IF;
 IF EXISTS (SELECT 1 FROM source_before b JOIN beach_sources s USING (beach_id)
 WHERE b.beach_id NOT IN ({ids}) AND b.camera_url IS DISTINCT FROM s.camera_url) THEN
 RAISE EXCEPTION 'migration changed unrelated camera'; END IF;
END $$;
UPDATE beach_sources SET camera_url = 'https://example.com/preserve-existing' WHERE beach_id IN ({ids});
{body}
DO $$ BEGIN
 IF (SELECT count(*) FROM beach_sources WHERE beach_id IN ({ids}) AND camera_url = 'https://example.com/preserve-existing') <> 7 THEN
 RAISE EXCEPTION 'migration overwrote an existing camera'; END IF;
END $$;
ROLLBACK;
'''
subprocess.run(['psql', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-X', '-v', 'ON_ERROR_STOP=1'], input=sql, text=True, check=True)
print('PASS: seven exact mappings, idempotency, existing camera/settings preservation; rolled back')
