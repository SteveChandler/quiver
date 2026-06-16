import { readdirSync, readFileSync } from "fs";
import { join } from "path";

type NewBeachRow = {
  slug: string;
  name: string;
  city: string;
  region: string;
  lat: string;
  lon: string;
  breakType: string;
  skillLevel: string;
  crowdLevel: string;
};

describe("Monterey and Big Sur beach spots migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  const newBeachRows: NewBeachRow[] = [
    {
      slug: "carmel-beach-carmel-ca",
      name: "Carmel Beach",
      city: "Carmel-by-the-Sea",
      region: "Monterey Peninsula",
      lat: "36.55",
      lon: "-121.93",
      breakType: "beach",
      skillLevel: "intermediate",
      crowdLevel: "moderate",
    },
    {
      slug: "monastery-beach-san-jose-creek-beach-carmel-ca",
      name: "Monastery Beach / San Jose Creek Beach",
      city: "Carmel",
      region: "Monterey Peninsula",
      lat: "36.525",
      lon: "-121.927",
      breakType: "beach",
      skillLevel: "expert",
      crowdLevel: "light",
    },
    {
      slug: "ghost-tree-pebble-beach-ca",
      name: "Ghost Tree",
      city: "Pebble Beach",
      region: "Monterey Peninsula",
      lat: "36.56",
      lon: "-121.967",
      breakType: "reef",
      skillLevel: "expert",
      crowdLevel: "light",
    },
    {
      slug: "spanish-bay-south-moss-beach-pebble-beach-ca",
      name: "Spanish Bay / South Moss Beach",
      city: "Pebble Beach",
      region: "Monterey Peninsula",
      lat: "36.62",
      lon: "-121.95",
      breakType: "beach",
      skillLevel: "intermediate",
      crowdLevel: "moderate",
    },
    {
      slug: "asilomar-state-beach-pacific-grove-ca",
      name: "Asilomar State Beach",
      city: "Pacific Grove",
      region: "Monterey Peninsula",
      lat: "36.63",
      lon: "-121.94",
      breakType: "beach",
      skillLevel: "intermediate-advanced",
      crowdLevel: "moderate",
    },
    {
      slug: "lovers-point-pacific-grove-ca",
      name: "Lovers Point",
      city: "Pacific Grove",
      region: "Monterey Peninsula",
      lat: "36.63",
      lon: "-121.92",
      breakType: "point",
      skillLevel: "intermediate-advanced",
      crowdLevel: "moderate",
    },
    {
      slug: "del-monte-beach-monterey-ca",
      name: "Del Monte Beach",
      city: "Monterey",
      region: "Monterey Bay",
      lat: "36.6",
      lon: "-121.88",
      breakType: "beach",
      skillLevel: "beginner-intermediate",
      crowdLevel: "moderate",
    },
    {
      slug: "marina-state-beach-marina-ca",
      name: "Marina State Beach",
      city: "Marina",
      region: "Monterey Bay",
      lat: "36.69",
      lon: "-121.81",
      breakType: "beach",
      skillLevel: "intermediate-advanced",
      crowdLevel: "moderate",
    },
    {
      slug: "moss-landing-moss-landing-ca",
      name: "Moss Landing",
      city: "Moss Landing",
      region: "Monterey Bay",
      lat: "36.81",
      lon: "-121.79",
      breakType: "beach",
      skillLevel: "intermediate-advanced",
      crowdLevel: "moderate",
    },
  ];

  const existingTargetSlugs = [
    "carmel-river-state-beach-carmel-ca",
    "garrapata-southern-coves-carmel-ca",
    "andrew-molera-river-mouth-big-sur-ca",
  ];

  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_add_monterey_big_sur_spots\.sql$/.test(filename),
    );

    expect(matches).toHaveLength(1);
    return readFileSync(join(migrationsDir, matches[0]), "utf8");
  }

  function extractInsertColumns(sql: string): string {
    const match = sql.match(
      /INSERT INTO public\.beaches\s*\(([\s\S]*?)\)\s*SELECT/i,
    );

    expect(match).not.toBeNull();
    return match?.[1] ?? "";
  }

  function extractExistingUpdateSetClause(sql: string): string {
    const match = sql.match(
      /UPDATE public\.beaches AS b\s+SET\s+([\s\S]*?)\s+FROM temp_monterey_big_sur_spots spot/i,
    );

    expect(match).not.toBeNull();
    return match?.[1] ?? "";
  }

  let migrationSQL: string;
  let normalizedSQL: string;

  beforeAll(() => {
    migrationSQL = readMigrationSQL();
    normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();
  });

  it("wraps the local data load in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("inserts the 9 new reachable beaches with complete location fields", () => {
    for (const row of newBeachRows) {
      const expectedPayload = [
        "true",
        `'${row.slug}'`,
        `'${row.name.toLowerCase()}'`,
        `'${row.city.toLowerCase()}'`,
        "'ca'",
        "'usa'",
        "'america/los_angeles'",
        row.lat,
        row.lon,
        `'${row.region.toLowerCase()}'`,
        `'${row.breakType}'`,
        `'${row.skillLevel}'`,
        `'${row.crowdLevel}'`,
      ].join(", ");

      expect(normalizedSQL).toContain(expectedPayload);
    }
  });

  it("targets the 3 existing equivalent rows for editorial enrichment", () => {
    for (const targetSlug of existingTargetSlugs) {
      expect(normalizedSQL).toContain(`false, '${targetSlug}'`);
    }
  });

  it("keeps unsupported source-only fields out of the migration", () => {
    for (const unsupportedColumn of [
      "location",
      "bottom_type",
      "confidence",
      "source_notes",
      "hero_photo_candidates",
      "needs_human_review",
      "geog",
    ]) {
      expect(normalizedSQL).not.toMatch(
        new RegExp(`\\b${unsupportedColumn}\\b`),
      );
    }
  });

  it("uses live break and crowd vocabulary without false-positive prose scans", () => {
    expect(migrationSQL).not.toMatch(/^\s*'(?:river|other)',\s*$/m);
    expect(migrationSQL).not.toMatch(/^\s*'heavy',\s*$/m);
    expect(normalizedSQL).toContain("'river-mouth'");
    expect(normalizedSQL).toContain("'crowded'"); // Present only as allowed vocabulary metadata.
  });

  it("maps shoreline aspect payloads to the supported aspect_deg column", () => {
    const insertColumns = extractInsertColumns(migrationSQL);

    expect(insertColumns).toMatch(/\baspect_deg\b/);
    expect(normalizedSQL).not.toContain("shoreline_aspect_deg");
  });

  it("uses an idempotent lower(slug) existence check instead of ON CONFLICT slug", () => {
    expect(normalizedSQL).toContain("not exists");
    expect(normalizedSQL).toContain("where b.deleted_at is null");
    expect(normalizedSQL).toContain("lower(b.slug) = lower(spot.target_slug)");
    expect(normalizedSQL).not.toMatch(/on\s+conflict\s*\(\s*slug\s*\)/);
  });

  it("does not update forecast, model, identity, or location columns on existing rows", () => {
    const updateSetClause = extractExistingUpdateSetClause(migrationSQL);

    for (const forbiddenAssignment of [
      /\blat\s*=/i,
      /\blon\s*=/i,
      /\bslug\s*=/i,
      /\bcity\s*=/i,
      /\bregion\s*=/i,
      /\bbreak_type\s*=/i,
      /\bskill_level\s*=/i,
      /\bcrowd_level\s*=/i,
      /\bpreference_model\s*=/i,
      /\bswell_window_[a-z_]+\s*=/i,
      /\bwind_[a-z_]+\s*=/i,
      /\bpreferred_tide_[a-z_]+\s*=/i,
      /\baspect_deg\s*=/i,
      /\bcdip_[a-z_]+\s*=/i,
      /\bterrain_[a-z_]+\s*=/i,
      /\bshoaling_factors\s*=/i,
    ]) {
      expect(updateSetClause).not.toMatch(forbiddenAssignment);
    }

    for (const allowedAssignment of [
      "description",
      "hazards",
      "features",
      "warnings",
      "parking_tips",
      "access_tips",
      "wave_tips",
      "crowd_tips",
      "best_conditions_prose",
      "local_etiquette",
      "real_takeaways",
      "best_months",
    ]) {
      expect(updateSetClause).toMatch(
        new RegExp(`\\b${allowedAssignment}\\s*=`, "i"),
      );
    }
  });
});
