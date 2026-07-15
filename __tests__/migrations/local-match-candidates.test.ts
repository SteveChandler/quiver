import fs from "fs";
import path from "path";

interface Coordinate {
  lat: number;
  lon: number;
}

const WAIKIKI: Coordinate = { lat: 21.2767, lon: -157.8275 };
const BLACKS_BEACH: Coordinate = { lat: 32.88, lon: -117.25 };
const DEFAULT_LOCAL_RADIUS_KM = 100;

function distanceKm(from: Coordinate, to: Coordinate): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lon - from.lon);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

describe("local match candidates migration", () => {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const migrationPath = fs
    .readdirSync(migrationsDir)
    .find((name) => name.endsWith("_local_match_candidates.sql"));

  function readMigration(): string {
    expect(migrationPath).toEqual(expect.any(String));
    return fs.readFileSync(path.join(migrationsDir, migrationPath!), "utf8");
  }

  it("excludes a Southern California favorite from a Waikiki local search", () => {
    expect(distanceKm(WAIKIKI, BLACKS_BEACH)).toBeGreaterThan(DEFAULT_LOCAL_RADIUS_KM);

    const sql = readMigration();
    const localCandidates = sql.slice(
      sql.indexOf("local_candidate_beaches AS ("),
      sql.indexOf("favorite_candidate_beaches AS ("),
    );

    expect(localCandidates).toContain("WHERE v_have_device");
    expect(localCandidates).toContain("ST_DWithin(");
    expect(localCandidates).toContain("v_effective_radius_km * 1000");
    expect(localCandidates).not.toContain("favorite_beaches");
    expect(localCandidates).not.toContain("UNION");
  });

  it("keeps the coordinate-free favorite fallback for existing callers", () => {
    const sql = readMigration();
    const favoriteCandidates = sql.slice(
      sql.indexOf("favorite_candidate_beaches AS ("),
      sql.indexOf("combined_candidate_beaches AS ("),
    );

    expect(sql).not.toContain("IF NOT v_have_device THEN");
    expect(favoriteCandidates).toContain("WHERE NOT v_have_device");
    expect(favoriteCandidates).toContain("FROM public.favorite_beaches fb");
    expect(favoriteCandidates).toContain("'favorite'::text AS candidate_source");
  });

  it("bounds no-limit profiles and configured drive ranges at the server", () => {
    const sql = readMigration();

    expect(sql).toContain("SELECT p.max_drive_minutes");
    expect(sql).toContain("THEN 100.0");
    expect(sql).toContain("GREATEST(v_max_drive_minutes, 15)");
    expect(sql).toContain("LEAST(");
    expect(sql).toContain("0.5 * 1.609344");
    expect(sql).toContain("COALESCE(p_radius_km, v_profile_radius_km)");
  });

  it("returns local distance and provenance without changing the RPC row shape", () => {
    const sql = readMigration();

    expect(sql).toContain("RETURNS TABLE(beach jsonb, score numeric, label text)");
    expect(sql).toContain("ST_Distance(");
    expect(sql).toContain("'distance_km', s.distance_km");
    expect(sql).toContain("'device_radius'::text AS candidate_source");
    expect(sql).toContain("'candidate_source', s.candidate_source");
  });

  it("preserves caller, entitlement, search-path, and grant boundaries", () => {
    const sql = readMigration();

    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO 'public', 'extensions', 'pg_temp'");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("auth.role()");
    expect(sql).toContain("p_user_id <> v_caller");
    expect(sql).toContain("FROM public.user_entitlements ue");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.get_user_match_candidates");
    expect(sql).toContain("TO authenticated");
    expect(sql).toContain("TO service_role");
    expect(sql).not.toContain("TO anon");
  });
});
