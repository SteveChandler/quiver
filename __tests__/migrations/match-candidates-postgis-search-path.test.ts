import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('match candidates PostGIS search path migration', () => {
  it('makes PostGIS geography types available to the security-definer RPC', () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260712160000_fix_match_candidates_postgis_search_path.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('ALTER FUNCTION public.get_user_match_candidates');
    expect(migration).toContain('SET search_path = public, extensions, pg_temp');
    expect(migration).not.toContain('DROP FUNCTION');
  });
});
