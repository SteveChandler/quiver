"""Exercise the Redondo jetty migration on local Supabase; every write rolls back.

The local database predates the editorial/eligibility columns, so each transaction first
adds them with their production definitions. That stand-in is rolled back with everything else.
"""
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
sql = (root / 'supabase/migrations/20260914160000_add_sapphire_street_redondo_beach.sql').read_text()
assert sql.endswith('COMMIT;\n') and '\nBEGIN;\n' in sql
body = re.sub(r'^BEGIN;\n|^COMMIT;\n', '', sql, flags=re.M)
rows = [
    ('c9ea72a3-d7bf-5f3d-b77e-1aa6cce81dee', 'Sapphire Street (Redondo Beach)', 'sapphire-street-redondo-beach-ca', 33.8325, -118.3918, 7),
    ('50b0ec6c-9254-5450-9b23-90cb85997cb1', 'Knob Hill (Redondo Beach)', 'knob-hill-redondo-beach-ca', 33.8290, -118.3922, 5),
]
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
row_checks = '\n'.join(f'''
  IF (SELECT count(*) FROM public.beaches WHERE id = '{i}' AND name = '{n}' AND slug = '{s}'
      AND city = 'Redondo Beach' AND lat = {la} AND lon = {lo} AND timezone = 'America/Los_Angeles'
      AND NOT seo_indexable AND NOT recommendation_eligible AND NOT terrain_enabled AND NOT is_private
      AND shoaling_factors IS NULL AND jsonb_array_length(editorial_sources) = {k}) <> 1 THEN
    RAISE EXCEPTION 'expected exact conservative row for {n}'; END IF;
  IF (SELECT count(*) FROM public.beach_sources WHERE beach_id = '{i}' AND forecast_source_id = 'open_meteo') <> 1 THEN
    RAISE EXCEPTION 'forecast source mapping missing for {n}'; END IF;''' for i, n, s, la, lo, k in rows)
checks = f'''
DO $$ BEGIN
{row_checks}
  IF (SELECT count(*) FROM public.beaches WHERE name ILIKE '%sapphir%') <> 1
     OR (SELECT count(*) FROM public.beaches WHERE name ILIKE '%redondo beach%') < 2 THEN
    RAISE EXCEPTION 'native name-only search would still miss a user query'; END IF;
  IF EXISTS (SELECT 1 FROM before_beaches old JOIN public.beaches b USING (id) WHERE to_jsonb(old) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'existing beach was modified'; END IF;
  IF EXISTS (SELECT 1 FROM before_sources old JOIN public.beach_sources s USING (beach_id) WHERE to_jsonb(old) IS DISTINCT FROM to_jsonb(s)) THEN
    RAISE EXCEPTION 'existing source was modified'; END IF;
END $$;
'''

# Apply, check, re-apply (idempotency), check again, roll back.
rerun = 'DROP TABLE _redondo_jetty_beaches;\n'
subprocess.run(command, input='BEGIN;\n' + standin + snapshot + body + checks + rerun + body + checks + 'ROLLBACK;\n',
               text=True, check=True, capture_output=True)


def expect_failure(label: str, setup: str, message: str) -> None:
    result = subprocess.run(command, input='BEGIN;\n' + standin + setup + body + 'ROLLBACK;\n',
                            text=True, capture_output=True)
    assert result.returncode != 0 and message in result.stderr, (label, result.stderr)


# The same UUID at a different coordinate must stop the whole transaction.
expect_failure('uuid', body + rerun + f"UPDATE public.beaches SET lat = lat + 0.01 WHERE id = '{rows[1][0]}';\n",
               'UUID identity or coordinate conflict')
# An unrelated beach inside 300 m of either pin means the break may already exist under another name.
for label, lat, lon in (('near-sapphire', 33.8330, -118.3915), ('near-knob-hill', 33.8285, -118.3925)):
    expect_failure(label, "INSERT INTO public.beaches (id, name, slug, lat, lon) VALUES "
                   f"(gen_random_uuid(), 'Nearby Test', 'nearby-test', {lat}, {lon});\n",
                   'existing beach within 300 m')
# A name collision under a different UUID must also stop it.
expect_failure('name', "INSERT INTO public.beaches (id, name, slug, lat, lon) VALUES "
               "(gen_random_uuid(), 'Knob Hill (Redondo Beach)', 'other-slug', 34.0, -118.5);\n",
               'conflicts with existing name or slug')
print('PASS: 2 exact rows, open_meteo sources, both user queries match by name, idempotent re-run, '
      'existing rows unchanged, UUID/nearby/name guards fire; all writes rolled back')
