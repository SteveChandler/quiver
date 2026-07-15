import { execFileSync } from "node:child_process";
import { join } from "node:path";

const DATABASE_URL = process.env.MATCH_CANDIDATES_DATABASE_URL;
const RUN_INTEGRATION = process.env.RUN_SUPABASE_INTEGRATION === "1";
const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260715051000_local_match_candidates.sql",
);

function localDatabaseUrl(): string {
  if (!DATABASE_URL) throw new Error("MATCH_CANDIDATES_DATABASE_URL is required");
  const hostname = new URL(DATABASE_URL).hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") {
    throw new Error("Match-candidate integration tests may only use a loopback database");
  }
  return DATABASE_URL;
}

function psql(...args: string[]): string {
  return execFileSync("psql", [localDatabaseUrl(), "-X", "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
  }).trim();
}

function psqlScript(sql: string): string {
  return execFileSync(
    "psql",
    [localDatabaseUrl(), "-X", "-v", "ON_ERROR_STOP=1", "-At"],
    { encoding: "utf8", input: sql },
  ).trim();
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

describeIntegration("local match candidates RPC (local Supabase)", () => {
  it("keeps Waikiki device results local while preserving the no-device favorite fallback", () => {
    psql("-f", MIGRATION);

    const output = psqlScript(`
      BEGIN;
      SET LOCAL request.jwt.claim.role = 'service_role';

      INSERT INTO public.profiles (id, full_name, max_drive_minutes)
      VALUES ('00000000-0000-0000-0000-000000000080', 'Issue 80 Test User', NULL);

      INSERT INTO public.beaches (id, name, slug, city, state, country, lat, lon)
      VALUES
        ('00000000-0000-0000-0000-000000000801', 'Issue 80 Waikiki', 'issue-80-waikiki', 'Honolulu', 'HI', 'USA', 21.27625, -157.82925),
        ('00000000-0000-0000-0000-000000000802', 'Issue 80 Sandy Beach', 'issue-80-sandy-beach', 'Honolulu', 'HI', 'USA', 21.28725, -157.66925),
        ('00000000-0000-0000-0000-000000000899', 'Issue 80 Southern California Favorite', 'issue-80-socal-favorite', 'La Jolla', 'CA', 'USA', 32.88, -117.25);

      INSERT INTO public.favorite_beaches (user_id, beach_id, rank)
      VALUES ('00000000-0000-0000-0000-000000000080', '00000000-0000-0000-0000-000000000899', 1);

      INSERT INTO public.enhanced_forecasts (
        -- These legacy columns remain NOT NULL in the schema even though the
        -- RPC and all new forecast reads use forecast_at exclusively.
        beach_id, forecast_date, forecast_time, forecast_at,
        wave_height, wave_period, wind_speed, wind_direction_deg, tide_height
      )
      SELECT
        id, (now() + interval '1 minute')::date, (now() + interval '1 minute')::time,
        now() + interval '1 minute', '3 ft', '12s', '4 mph', 210, '3 ft'
      FROM public.beaches
      WHERE id IN (
        '00000000-0000-0000-0000-000000000801',
        '00000000-0000-0000-0000-000000000802',
        '00000000-0000-0000-0000-000000000899'
      );

      CREATE OR REPLACE FUNCTION public.compute_user_match_score(
        p_user_id uuid, p_beach_id uuid, p_wave_height text, p_wave_period text,
        p_wind_speed text, p_wind_direction text, p_tide_height text
      )
      RETURNS jsonb
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path TO 'public'
      AS $$
        SELECT jsonb_build_object('state', 'ready', 'score', 7.0, 'label', 'GOOD');
      $$;

      CREATE TEMP TABLE device_results ON COMMIT DROP AS
      SELECT * FROM public.get_user_match_candidates(
        '00000000-0000-0000-0000-000000000080', NULL,
        21.2767, -157.8275, 100, 5
      );

      UPDATE public.profiles
      SET max_drive_minutes = 15
      WHERE id = '00000000-0000-0000-0000-000000000080';

      CREATE TEMP TABLE drive_limited_results ON COMMIT DROP AS
      SELECT * FROM public.get_user_match_candidates(
        '00000000-0000-0000-0000-000000000080', NULL,
        21.2767, -157.8275, 100, 5
      );

      CREATE TEMP TABLE favorite_results ON COMMIT DROP AS
      SELECT * FROM public.get_user_match_candidates(
        '00000000-0000-0000-0000-000000000080', NULL,
        NULL, NULL, 100, 5
      );

      SELECT json_build_object(
        'device_ids', (SELECT json_agg(beach->>'id' ORDER BY beach->>'id') FROM device_results),
        'invalid_device_rows', (SELECT count(*) FROM device_results WHERE
          beach->>'candidate_source' <> 'device_radius'
          OR (beach->>'distance_km')::double precision > 100),
        'drive_limited_ids', (SELECT json_agg(beach->>'id' ORDER BY beach->>'id') FROM drive_limited_results),
        'favorite_ids', (SELECT json_agg(beach->>'id' ORDER BY beach->>'id') FROM favorite_results),
        'invalid_favorite_rows', (SELECT count(*) FROM favorite_results WHERE
          beach->>'candidate_source' <> 'favorite'
          OR beach->>'distance_km' IS NOT NULL)
      );
      ROLLBACK;
    `);
    const jsonLine = output.split("\n").find((line) => line.startsWith("{"));
    expect(jsonLine).toEqual(expect.any(String));
    const result = JSON.parse(jsonLine!) as {
      device_ids: string[];
      invalid_device_rows: number;
      drive_limited_ids: string[];
      favorite_ids: string[];
      invalid_favorite_rows: number;
    };

    expect(result).toEqual({
      device_ids: [
        "00000000-0000-0000-0000-000000000801",
        "00000000-0000-0000-0000-000000000802",
      ],
      invalid_device_rows: 0,
      drive_limited_ids: ["00000000-0000-0000-0000-000000000801"],
      favorite_ids: ["00000000-0000-0000-0000-000000000899"],
      invalid_favorite_rows: 0,
    });
  });
});
