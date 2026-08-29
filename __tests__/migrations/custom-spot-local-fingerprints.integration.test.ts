import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const DATABASE_URL = process.env.CUSTOM_SPOT_FINGERPRINT_DATABASE_URL;
const RUN_INTEGRATION = process.env.RUN_SUPABASE_INTEGRATION === '1';
const MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260828120000_add_custom_spot_local_fingerprints.sql',
);

function localDatabaseUrl(): string {
  if (!DATABASE_URL) throw new Error('CUSTOM_SPOT_FINGERPRINT_DATABASE_URL is required');
  const hostname = new URL(DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error('Custom-spot fingerprint integration tests require a loopback database');
  }
  return DATABASE_URL;
}

function psql(...args: string[]): string {
  return execFileSync(
    'psql',
    [localDatabaseUrl(), '-X', '-v', 'ON_ERROR_STOP=1', ...args],
    { encoding: 'utf8' },
  ).trim();
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('custom spot fingerprint migration (local Supabase)', () => {
  it('blocks forged fields, rejects stale leases, and clears provenance to unset', () => {
    psql('-f', MIGRATION);
    const result = JSON.parse(psql('-Atc', `
      BEGIN;
      INSERT INTO auth.users (id, email)
      VALUES ('00000000-0000-0000-0000-000000000929', 'fingerprint-test@quiversurf.app')
      ON CONFLICT (id) DO NOTHING;
      SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000929', true);
      SELECT set_config('request.jwt.claim.role', 'authenticated', true);

      INSERT INTO public.custom_spots (
        id, user_id, name, lat, lon, visibility, facing_direction_deg,
        swell_access_factors, terrain_status, fingerprint_model_version
      ) VALUES (
        '00000000-0000-0000-0000-000000000930',
        '00000000-0000-0000-0000-000000000929', 'Fingerprint Test', 32.8, -117.2,
        'private', 270, array_fill(1::numeric, ARRAY[72]), 'ok', 'forged'
      );

      UPDATE public.custom_spots
      SET facing_direction_deg = NULL
      WHERE id = '00000000-0000-0000-0000-000000000930';
      CREATE TEMP TABLE fingerprint_checks ON COMMIT DROP AS
      SELECT
        swell_access_factors IS NULL AND fingerprint_model_version IS NULL AS forgery_stripped,
        fingerprint_confidence = 'unset'
          AND fingerprint_provenance_state = 'unset'
          AND fingerprint_provenance->'fields' = '{}'::jsonb AS clear_unset
      FROM public.custom_spots
      WHERE id = '00000000-0000-0000-0000-000000000930';

      SELECT set_config('request.jwt.claim.sub', '', true);
      UPDATE public.custom_spots SET
        facing_direction_deg = 270,
        swell_access_factors = array_fill(1::real, ARRAY[72]),
        wind_exposure_factors = array_fill(1::real, ARRAY[72]),
        terrain_status = 'ok',
        fingerprint_model_version = 'custom_spot_terrain_v1',
        fingerprint_confidence = 'modeled',
        fingerprint_provenance_state = 'modeled',
        fingerprint_provenance = '{"schema_version":1,"fields":{"facing_direction_deg":"modeled","swell_access_factors":"modeled","wind_exposure_factors":"modeled"}}'::jsonb
      WHERE id = '00000000-0000-0000-0000-000000000930';
      SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000929', true);
      UPDATE public.custom_spots
      SET facing_direction_deg = NULL
      WHERE id = '00000000-0000-0000-0000-000000000930';

      SELECT json_build_object(
        'forgery_stripped', (SELECT forgery_stripped FROM fingerprint_checks),
        'clear_unset', (SELECT clear_unset FROM fingerprint_checks),
        'modeled_clear_preserved', fingerprint_confidence = 'modeled'
          AND fingerprint_provenance_state = 'modeled'
          AND fingerprint_provenance->'fields'->>'facing_direction_deg' IS NULL,
        'stale_lease_rejected', NOT public.complete_custom_spot_analysis_job(
          (SELECT id FROM public.custom_spot_analysis_jobs
           WHERE custom_spot_id = '00000000-0000-0000-0000-000000000930'),
          now() - interval '1 hour', updated_at, '{}'::jsonb
        )
      )
      FROM public.custom_spots
      WHERE id = '00000000-0000-0000-0000-000000000930';
      ROLLBACK;
    `).split('\n').find((line) => line.startsWith('{'))!) as Record<string, boolean>;

    expect(result).toEqual({
      forgery_stripped: true,
      clear_unset: true,
      modeled_clear_preserved: true,
      stale_lease_rejected: true,
    });
  });
});
