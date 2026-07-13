import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATABASE_URL = process.env.OAHU_CATALOG_DATABASE_URL;
const RUN_INTEGRATION = process.env.RUN_SUPABASE_INTEGRATION === "1";
const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260712230000_complete_oahu_beach_catalog.sql",
);

const NEW_SLUGS = [
  "makaha", "white-plains", "laniakea", "chuns-reef", "tracks",
  "kewalo-basin", "rocky-point", "off-the-wall", "makapuu", "publics",
  "velzyland", "backyards", "pops", "threes", "kaisers", "puaena-point",
] as const;

function localDatabaseUrl(): string {
  if (!DATABASE_URL) throw new Error("OAHU_CATALOG_DATABASE_URL is required");
  const hostname = new URL(DATABASE_URL).hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") {
    throw new Error("OAHU catalog integration tests may only use a loopback database");
  }
  return DATABASE_URL;
}

function psql(...args: string[]): string {
  return execFileSync("psql", [localDatabaseUrl(), "-X", "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
  }).trim();
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

describeIntegration("Oahu beach catalog migration (local Supabase)", () => {
  it("applies twice and leaves exactly one complete row per new beach", () => {
    psql("-f", MIGRATION);
    const idsBefore = psql("-Atc", `
      SELECT string_agg(id::text, ',' ORDER BY slug)
      FROM beaches WHERE slug = ANY (ARRAY[${NEW_SLUGS.map((slug) => `'${slug}'`).join(",")}]);
    `);

    psql("-f", MIGRATION);
    const result = JSON.parse(psql("-Atc", `
      WITH seeded AS (
        SELECT * FROM beaches
        WHERE deleted_at IS NULL
          AND slug = ANY (ARRAY[${NEW_SLUGS.map((slug) => `'${slug}'`).join(",")}])
      )
      SELECT json_build_object(
        'count', (SELECT count(*) FROM seeded),
        'distinct_slugs', (SELECT count(DISTINCT slug) FROM seeded),
        'ids', (SELECT string_agg(id::text, ',' ORDER BY slug) FROM seeded),
        'incomplete', (SELECT count(*) FROM seeded WHERE
          lat IS NULL OR lon IS NULL OR geog IS NULL OR city IS NULL OR region IS NULL
          OR timezone <> 'Pacific/Honolulu' OR break_type IS NULL OR skill_level IS NULL
          OR crowd_level IS NULL OR hazards IS NULL OR description IS NULL
          OR parking_tips IS NULL OR access_tips IS NULL OR wave_tips IS NULL
          OR crowd_tips IS NULL OR best_conditions_prose IS NULL OR local_etiquette IS NULL
          OR swell_window_min_deg IS NULL OR swell_window_max_deg IS NULL
          OR swell_window_center_deg IS NULL OR swell_window_halfwidth_deg IS NULL
          OR wind_offshore_deg IS NULL OR wind_offshore_tol_deg IS NULL
          OR preferred_tide_ft_min IS NULL OR preferred_tide_ft_max IS NULL
          OR preferred_tide_direction IS NULL OR best_months IS NULL OR persona IS NULL
          OR deepwater_decay_factor IS NULL OR nws_office <> 'HFO' OR is_private IS DISTINCT FROM false),
        'near_duplicates', (SELECT count(*) FROM seeded a JOIN seeded b ON a.id < b.id
          AND ST_DWithin(a.geog, b.geog, 150)),
        'haleiwa', (SELECT json_build_object('id', id, 'slug', slug, 'name', name)
          FROM beaches WHERE id = '43cfaf0d-0376-45cb-a8bd-78087ba4ee15'),
        'camera', (SELECT json_build_object('url', camera_url, 'handle', youtube_channel_handle)
          FROM beach_sources WHERE beach_id = '80fc2c1b-2d3f-4a94-bcc2-c8ea0e9b8fc5')
      );
    `)) as {
      count: number; distinct_slugs: number; ids: string; incomplete: number;
      near_duplicates: number;
      haleiwa: { id: string; slug: string; name: string };
      camera: { url: string; handle: string };
    };

    expect(result).toMatchObject({
      count: 16,
      distinct_slugs: 16,
      ids: idsBefore,
      incomplete: 0,
      near_duplicates: 0,
      haleiwa: {
        id: "43cfaf0d-0376-45cb-a8bd-78087ba4ee15",
        slug: "haleiwa",
        name: "Haleʻiwa Aliʻi Beach",
      },
      camera: {
        url: "https://www.youtube.com/watch?v=Bk2qxqAill8",
        handle: "@wozereme",
      },
    });
  });
});
