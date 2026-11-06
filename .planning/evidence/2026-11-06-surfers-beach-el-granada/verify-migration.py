"""Exercise the Surfers Beach migration on a throwaway Postgres; every write rolls back.

Usage: verify-migration.py <psql connection URL>

The database must hold public.beaches and public.beach_sources as dumped from production
(schema without the PostGIS geog column, plus data), so the guards run against the real catalog.
"""
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[3]
sql = (root / 'supabase/migrations/20261106180000_add_surfers_beach_el_granada.sql').read_text()
assert sql.endswith('COMMIT;\n') and '\nBEGIN;\n' in sql
body = re.sub(r'^BEGIN;\n|^COMMIT;\n', '', sql, flags=re.M)
row = ('73cfa55c-0708-533b-b8c8-9af6db7bc7b2', 'Surfers Beach / Princeton Jetty (El Granada)',
       'surfers-beach-el-granada-ca', 37.4994, -122.4715)
command = ['psql', sys.argv[1], '-X', '-v', 'ON_ERROR_STOP=1']

snapshot = '''
CREATE TEMP TABLE before_beaches ON COMMIT DROP AS SELECT * FROM public.beaches;
CREATE TEMP TABLE before_sources ON COMMIT DROP AS SELECT * FROM public.beach_sources;
'''
i, n, s, la, lo = row
checks = f'''
DO $$ BEGIN
  IF (SELECT count(*) FROM public.beaches WHERE id = '{i}' AND name = '{n}' AND slug = '{s}'
      AND city = 'El Granada' AND lat = {la} AND lon = {lo} AND timezone = 'America/Los_Angeles'
      AND NOT seo_indexable AND NOT recommendation_eligible AND NOT terrain_enabled AND NOT is_private
      AND shoaling_factors IS NULL AND jsonb_array_length(editorial_sources) = 5) <> 1 THEN
    RAISE EXCEPTION 'expected exact conservative row'; END IF;
  IF (SELECT count(*) FROM public.beach_sources WHERE beach_id = '{i}' AND forecast_source_id = 'open_meteo') <> 1 THEN
    RAISE EXCEPTION 'forecast source mapping missing'; END IF;
  IF (SELECT count(*) FROM public.beaches WHERE name ILIKE '%princeton jetty%') <> 1
     OR NOT EXISTS (SELECT 1 FROM public.beaches WHERE id = '{i}' AND name ILIKE '%surfers beach%')
     OR NOT EXISTS (SELECT 1 FROM public.beaches WHERE id = '{i}' AND name ILIKE '%el granada%') THEN
    RAISE EXCEPTION 'native name-only search would still miss a user query'; END IF;
  IF (SELECT count(*) FROM public.beaches) <> (SELECT count(*) FROM before_beaches) + 1 THEN
    RAISE EXCEPTION 'expected exactly one new beach'; END IF;
  IF EXISTS (SELECT 1 FROM before_beaches old JOIN public.beaches b USING (id) WHERE to_jsonb(old) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'existing beach was modified'; END IF;
  IF EXISTS (SELECT 1 FROM before_sources old JOIN public.beach_sources x USING (beach_id) WHERE to_jsonb(old) IS DISTINCT FROM to_jsonb(x)) THEN
    RAISE EXCEPTION 'existing source was modified'; END IF;
END $$;
'''

# Apply, check, re-apply (idempotency), check again, roll back.
rerun = 'DROP TABLE _surfers_beach_el_granada;\n'
subprocess.run(command, input='BEGIN;\n' + snapshot + body + checks + rerun + body + checks + 'ROLLBACK;\n',
               text=True, check=True, capture_output=True)


def expect_failure(label: str, setup: str, message: str) -> None:
    result = subprocess.run(command, input='BEGIN;\n' + setup + body + 'ROLLBACK;\n',
                            text=True, capture_output=True)
    assert result.returncode != 0 and message in result.stderr, (label, result.stderr)


# The same UUID at a different coordinate must stop the whole transaction.
expect_failure('uuid', body + rerun + f"UPDATE public.beaches SET lat = lat + 0.01 WHERE id = '{i}';\n",
               'UUID identity or coordinate conflict')
# An unrelated beach inside 300 m of the pin means the break may already exist under another name.
expect_failure('nearby', "INSERT INTO public.beaches (id, name, slug, lat, lon, timezone) VALUES "
               "(gen_random_uuid(), 'Nearby Test', 'nearby-test', 37.5000, -122.4712, 'America/Los_Angeles');\n",
               'existing beach within 300 m')
# A slug collision under a different UUID must also stop it.
expect_failure('slug', "INSERT INTO public.beaches (id, name, slug, lat, lon, timezone) VALUES "
               f"(gen_random_uuid(), 'Other Name', '{s}', 36.0, -121.0, 'America/Los_Angeles');\n",
               'conflicts with existing name or slug')
print('PASS: exact row, open_meteo source, all three user terms match by name, one new row, '
      'idempotent re-run, existing rows unchanged, UUID/nearby/slug guards fire; all writes rolled back')
