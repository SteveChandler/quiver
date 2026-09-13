"""Exercise the catalog migration on local Supabase; all writes roll back."""
import json
import re
import subprocess
from pathlib import Path

folder = Path(__file__).resolve().parent
root = folder.parents[2]
rows = json.loads((folder / 'proposed.json').read_text())
photos = json.loads((folder / 'approved-photos.json').read_text())
assert len(rows) == 28 and len({r['id'] for r in rows}) == 28
assert len(photos) == 5
assert all(p['license_url'] in p['attribution_html'] and p['source_page'] in p['attribution_html'] for p in photos)
sql = (root / 'supabase/migrations/20260903200000_add_verified_catalog_gap_beaches.sql').read_text()
assert sql.endswith('COMMIT;\n') and '\nBEGIN;\n' in sql
body = re.sub(r'^BEGIN;\n|^COMMIT;\n', '', sql, flags=re.M)
def quote(value):
    return "'" + str(value).replace("'", "''") + "'"
expected = json.dumps([{k: r.get(k) for k in ['id','name','slug','lat','lon','timezone','camera_url']} for r in rows])
photo_expected = ','.join('('+quote(r['beach_id'])+'::uuid,'+quote(r['source_id'])+')' for r in photos)
checks = f'''
DO $$ BEGIN
 IF (SELECT count(*) FROM expected e JOIN beaches b USING(id)
 WHERE b.name=e.name AND b.slug=e.slug AND b.lat=e.lat AND b.lon=e.lon AND b.timezone=e.timezone
 AND NOT b.seo_indexable AND NOT b.recommendation_eligible AND NOT b.terrain_enabled
 AND b.shoaling_factors IS NULL AND jsonb_array_length(b.editorial_sources)>0) <> 28 THEN
 RAISE EXCEPTION 'expected28 exact catalog rows with conservative eligibility'; END IF;
 IF (SELECT count(*) FROM expected e JOIN beach_sources s ON s.beach_id=e.id
 WHERE s.forecast_source_id='open_meteo' AND s.camera_url IS NOT DISTINCT FROM e.camera_url) <> 28 THEN
 RAISE EXCEPTION 'source or camera mapping mismatch'; END IF;
 IF (SELECT count(*) FROM beach_photos WHERE (beach_id,source_id) IN (VALUES {photo_expected})
 AND source='wikimedia' AND approved AND deleted_at IS NULL AND license_url LIKE 'https://creativecommons.org/%') <> 5 THEN
 RAISE EXCEPTION 'licensed photo mapping mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM before_beaches old JOIN beaches b USING(id) WHERE to_jsonb(old) IS DISTINCT FROM to_jsonb(b)) THEN
 RAISE EXCEPTION 'existing beach was modified'; END IF;
 IF EXISTS (SELECT 1 FROM before_sources old JOIN beach_sources s USING(beach_id) WHERE to_jsonb(old) IS DISTINCT FROM to_jsonb(s)) THEN
 RAISE EXCEPTION 'existing source was modified'; END IF;
END $$;
'''
setup = f'''BEGIN;
CREATE TEMP TABLE expected ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset({quote(expected)}::jsonb)
 AS e(id uuid,name text,slug text,lat double precision,lon double precision,timezone text,camera_url text);
CREATE TEMP TABLE before_beaches ON COMMIT DROP AS SELECT * FROM beaches;
CREATE TEMP TABLE before_sources ON COMMIT DROP AS SELECT * FROM beach_sources;
'''
command = ['psql','postgresql://postgres:postgres@127.0.0.1:54322/postgres','-X','-v','ON_ERROR_STOP=1']
extra_photo = f"INSERT INTO beach_photos (beach_id,source,source_id,image_url,approved) VALUES ({quote(rows[0]['id'])},'wikimedia','File:Independent later photo.jpg','https://example.com/later.jpg',true);\n"
subprocess.run(command, input=setup+body+checks+extra_photo+'DROP TABLE _catalog_gap_beaches;\n'+body+checks+'ROLLBACK;', text=True, check=True)
# A matching UUID at the wrong coordinate must stop the whole transaction.
conflict = 'BEGIN;\n'+body+'DROP TABLE _catalog_gap_beaches;\n'+f"UPDATE beaches SET lat=lat+0.01 WHERE id={quote(rows[0]['id'])};\n"+body
result = subprocess.run(command, input=conflict, text=True, capture_output=True)
assert result.returncode != 0 and 'UUID identity or coordinate conflict' in result.stderr, result.stderr
print('PASS:28 rows, forecast/camera mappings,5 licensed photos, idempotency, existing data preservation, conflict guard; rolled back')
