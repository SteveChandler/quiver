"""Exercise the Bolsa Chica migration on local Supabase; every write rolls back.

The local database may predate the editorial/eligibility columns, so each transaction first
adds them with their production definitions. That stand-in is rolled back with everything else.
"""
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
sql = (root / 'supabase/migrations/20261031210000_add_bolsa_chica_state_beach.sql').read_text()
assert sql.endswith('COMMIT;\n') and '\nBEGIN;\n' in sql
body = re.sub(r'^BEGIN;\n|^COMMIT;\n', '', sql, flags=re.M)
beach_id = 'dd21a212-1f15-5b34-8749-8d54c44f3b25'
command = ['psql', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-X', '-v', 'ON_ERROR_STOP=1']

standin = '''
ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS editorial_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS editorial_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recommendation_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS seo_indexable boolean NOT NULL DEFAULT false;
'''
snapshot = '''
CREATE TEMP TABLE before_beaches ON COMMIT DROP AS SELECT * FROM public.beaches;
CREATE TEMP TABLE before_sources ON COMMIT DROP AS SELECT * FROM public.beach_sources;
'''
checks = f'''
DO $$ BEGIN
  IF (SELECT count(*) FROM public.beaches WHERE id = '{beach_id}' AND name = 'Bolsa Chica State Beach'
      AND slug = 'bolsa-chica-state-beach-huntington-beach-ca' AND city = 'Huntington Beach'
      AND region = 'Orange County' AND country = 'USA' AND break_type = 'beach'
      AND lat = 33.6970 AND lon = -118.0521 AND timezone = 'America/Los_Angeles'
      AND NOT seo_indexable AND NOT recommendation_eligible AND NOT terrain_enabled AND NOT is_private
      AND shoaling_factors IS NULL AND warnings = hazards
      AND jsonb_array_length(editorial_sources) = 9) <> 1 THEN
    RAISE EXCEPTION 'expected exact conservative row for Bolsa Chica State Beach'; END IF;
  IF (SELECT count(*) FROM public.beach_sources WHERE beach_id = '{beach_id}' AND forecast_source_id = 'open_meteo') <> 1 THEN
    RAISE EXCEPTION 'forecast source mapping missing'; END IF;
  IF (SELECT count(*) FROM public.beaches WHERE name ILIKE '%bolsa chica state beach%') <> 1
     OR (SELECT count(*) FROM public.beaches WHERE name ILIKE '%bolsa chica%') < 1 THEN
    RAISE EXCEPTION 'native name-only search would still miss a user query'; END IF;
  IF EXISTS (SELECT 1 FROM before_beaches old JOIN public.beaches b USING (id) WHERE to_jsonb(old) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'existing beach was modified'; END IF;
  IF EXISTS (SELECT 1 FROM before_sources old JOIN public.beach_sources s USING (beach_id) WHERE to_jsonb(old) IS DISTINCT FROM to_jsonb(s)) THEN
    RAISE EXCEPTION 'existing source was modified'; END IF;
END $$;
'''

# Apply, check, re-apply (idempotency), check again, roll back.
rerun = 'DROP TABLE _bolsa_chica_beaches;\n'
subprocess.run(command, input='BEGIN;\n' + standin + snapshot + body + checks + rerun + body + checks + 'ROLLBACK;\n',
               text=True, check=True, capture_output=True)


def expect_failure(label: str, setup: str, message: str) -> None:
    result = subprocess.run(command, input='BEGIN;\n' + standin + setup + body + 'ROLLBACK;\n',
                            text=True, capture_output=True)
    assert result.returncode != 0 and message in result.stderr, (label, result.stderr)


# The same UUID at a different coordinate must stop the whole transaction.
expect_failure('uuid', body + rerun + f"UPDATE public.beaches SET lat = lat + 0.01 WHERE id = '{beach_id}';\n",
               'UUID identity or coordinate conflict')
# An unrelated beach inside 300 m of the pin means the break may already exist under another name.
expect_failure('nearby', "INSERT INTO public.beaches (id, name, slug, lat, lon, timezone) VALUES "
               "(gen_random_uuid(), 'Nearby Test', 'nearby-test', 33.6973, -118.0515, 'America/Los_Angeles');\n",
               'existing beach within 300 m')
# A name collision under a different UUID must also stop it.
expect_failure('name', "INSERT INTO public.beaches (id, name, slug, lat, lon, timezone) VALUES "
               "(gen_random_uuid(), 'Bolsa Chica State Beach', 'other-slug', 34.0, -118.5, 'America/Los_Angeles');\n",
               'conflicts with existing name or slug')
print('PASS: exact conservative row, open_meteo source, user queries match by name, idempotent re-run, '
      'existing rows unchanged, UUID/nearby/name guards fire; all writes rolled back')
