"""Run the replay-column and resolver migrations on disposable local PostgreSQL.

Spatial primitives are test doubles; these checks exercise station freshness,
priority, immutable snapshot persistence, and rollback, not PostGIS geometry.
"""
import json
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLUMN = ROOT / 'supabase/migrations/20260911193000_add_display_replay_context.sql'
RESOLVER = ROOT / 'supabase/migrations/20260911193100_require_recent_wave_observation_station.sql'


def check():
    with tempfile.TemporaryDirectory(prefix='quiver-replay-sql-') as directory:
        root = Path(directory)
        data = root / 'data'
        started = False

        def run(args, sql=None):
            result = subprocess.run(args, input=sql, text=True, capture_output=True, timeout=45)
            assert result.returncode == 0, result.stderr
            return result.stdout.strip()

        def query(sql):
            return run(['psql', '-X', '-h', str(root), '-p', '55441', '-d', 'postgres',
                        '-v', 'ON_ERROR_STOP=1', '-qAt'], sql)

        def resolve():
            return query("select coalesce(get_beach_observation_station('00000000-0000-0000-0000-000000000001'),'NONE');")

        def reset():
            query('truncate ioos_stations,ndbc_direct_stations,unified_wave_observations; update beaches set cdip_station=null;')

        def station(table, station_id, distance, nearest=True, ioos=None):
            beach_id = '00000000-0000-0000-0000-000000000001' if nearest else '00000000-0000-0000-0000-000000000002'
            if table == 'ioos_stations':
                query(f"insert into {table} values ('{station_id}',true,true,'{beach_id}',{distance});")
            else:
                shadow = f"'{ioos}'" if ioos else 'null'
                query(f"insert into {table} values ('{station_id}',true,true,'{beach_id}',{distance},{distance}/1000.0,{shadow});")

        def observation(station_id, age='1 hour', value='1.0'):
            query(f"insert into unified_wave_observations values ('{station_id}',now()-interval '{age}',{value});")

        try:
            run(['initdb', '-D', str(data), '-A', 'trust', '--no-locale', '-E', 'UTF8'])
            run(['pg_ctl', '-D', str(data), '-l', str(root/'server.log'), '-o',
                 f"-k {root} -p 55441 -c listen_addresses=''", '-w', 'start'])
            started = True
            query('''
                create domain geography as double precision;
                create function st_dwithin(geography,geography,double precision) returns boolean
                  language sql immutable as 'select abs($1-$2)<=$3';
                create function st_distance(geography,geography) returns double precision
                  language sql immutable as 'select abs($1-$2)';
                create function swell_windows_overlap(integer,integer,integer,integer) returns integer
                  language sql immutable as 'select greatest(0,least($2,$4)-greatest($1,$3))';
                create table beaches(id uuid primary key,cdip_station text,geog geography,swell_window_min_deg integer,swell_window_max_deg integer);
                insert into beaches values('00000000-0000-0000-0000-000000000001',null,0,180,300),
                  ('00000000-0000-0000-0000-000000000002',null,1000,180,300);
                create table ioos_stations(station_id text,active boolean,has_wave_data boolean,nearest_beach_id uuid,coordinates geography);
                create table ndbc_direct_stations(station_id text,active boolean,has_wave_data boolean,nearest_beach_id uuid,
                  coordinates geography,distance_to_beach_km double precision,ioos_station_id text);
                create table unified_wave_observations(station_id text,observed_at timestamptz,wave_height_m double precision);
            ''')
            original = (ROOT / 'supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql').read_text()
            def definition(name):
                return re.search(r'CREATE OR REPLACE FUNCTION public\.' + name + r'\(.*?\n\$\$;', original, re.S).group()
            rpc = definition('persist_trusted_forecast_build')
            columns = re.search(r'AS snapshot\((.*?)\n      \)', rpc, re.S).group(1)
            query('create table ml_predictions_log(id serial primary key, untouched text,' + columns +
                  ', unique(beach_id,predicted_at,forecast_horizon_bucket,display_source));')
            query("insert into ml_predictions_log(raw_display_height_m,untouched) values(1.25,'preserve');")
            for name in ['trusted_forecast_canonical_number','trusted_forecast_canonical_timestamp',
                         'trusted_forecast_snapshot_columns','trusted_forecast_canonical_snapshot']:
                query(definition(name))
            baseline_hash = query("select md5(trusted_forecast_canonical_snapshot('{\"beach_id\":\"legacy\"}')::text);")
            # Run the installed RPC's exact snapshot insert block, without unrelated decision/receipt tables.
            insert_block = rpc[rpc.index('    WITH source AS ('):rpc.index('    v_reused_snapshot_count :=')]
            query('create function persist_trusted_forecast_build(p_payload jsonb) returns integer language plpgsql as $$ '
                  'declare v_inserted_snapshot_count integer; begin ' + insert_block + ' return v_inserted_snapshot_count; end; $$;')
            query(COLUMN.read_text())
            query(COLUMN.read_text())
            assert query('select display_replay_context is null and raw_display_height_m=1.25 and untouched=\'preserve\' from ml_predictions_log where id=1;') == 't'
            payload = {'snapshots':[{'beach_id':'00000000-0000-0000-0000-000000000001',
                'predicted_at':'2026-09-11T12:00:00Z','forecast_horizon_bucket':'0-24h','display_source':'test',
                'raw_display_height_m':1.5,'display_replay_context':{'version':1}}]}
            def persist():
                return query("select persist_trusted_forecast_build('" + json.dumps(payload) + "');")
            assert persist() == '1'
            payload['snapshots'][0]['raw_display_height_m'] = 8
            payload['snapshots'][0]['display_replay_context'] = {'version':2}
            assert persist() == '0'
            assert query("select md5(trusted_forecast_canonical_snapshot('{\"beach_id\":\"legacy\",\"display_replay_context\":null}')::text);") == baseline_hash
            assert query("select md5(trusted_forecast_canonical_snapshot('{\"beach_id\":\"legacy\",\"display_replay_context\":{\"version\":1}}')::text);") != baseline_hash
            assert query("select 'display_replay_context' = any(trusted_forecast_snapshot_columns());") == 't'
            assert json.loads(query('select display_replay_context from ml_predictions_log where id=2;')) == {'version': 1}
            assert query('select raw_display_height_m from ml_predictions_log where id=2;') == '1.5'
            query(RESOLVER.read_text())
            checks = 0
            # Each fallback tier must skip missing, stale, null and nonpositive waves.
            for table, nearest in [('ioos_stations',True),('ioos_stations',False),('ndbc_direct_stations',True),('ndbc_direct_stations',False)]:
                reset(); station(table,'candidate',1000,nearest)
                assert resolve() == 'NONE'
                observation('candidate','8 days'); assert resolve() == 'NONE'
                observation('candidate',value='null'); observation('candidate',value='0'); assert resolve() == 'NONE'
                observation('candidate'); assert resolve() == 'candidate'
                checks += 4
            # A stale nearer station cannot starve an eligible recent alternate.
            reset(); station('ioos_stations','stale',1000); observation('stale','8 days')
            station('ndbc_direct_stations','fresh',2000); observation('fresh')
            assert resolve() == 'fresh'; checks += 1
            # Preserve the explicit recent CDIP preference.
            query("update beaches set cdip_station='168' where id='00000000-0000-0000-0000-000000000001';")
            observation('edu_ucsd_cdip_168'); assert resolve() == 'edu_ucsd_cdip_168'; checks += 1
            reset(); station('ndbc_direct_stations','far',25001,False); observation('far')
            assert resolve() == 'NONE'; checks += 1
            reset(); station('ioos_stations','wrong-facing',1000,False); observation('wrong-facing')
            query("update beaches set swell_window_min_deg=0,swell_window_max_deg=30 where id='00000000-0000-0000-0000-000000000002';")
            assert resolve() == 'NONE'; checks += 1
            # Transaction rollback preserves a previous function definition.
            query("begin; create or replace function get_beach_observation_station(p_beach_id uuid) returns text language sql as 'select ''rollback-probe''::text'; rollback;")
            assert resolve() == 'NONE'; checks += 1
            print(json.dumps({'status':'PASS','station_checks':checks,'column_idempotent':True,'existing_rows_preserved':True,
                              'first_write_wins':True,'legacy_hash_preserved':True,'context_in_hash':True,'rpc_snapshot_insert':True,'production_mutations':0,'spatial_geometry':'test doubles; unchanged production predicates'}))
        finally:
            if started:
                run(['pg_ctl', '-D', str(data), '-m', 'fast', '-w', 'stop'])


if __name__ == '__main__':
    check()
