import { readdirSync, readFileSync } from "fs";
import { join } from "path";

describe("San Clemente spot profile enrichment migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_enrich_san_clemente_spot_profiles\.sql$/.test(filename)
    );

    expect(matches).toHaveLength(1);
    return readFileSync(join(migrationsDir, matches[0]), "utf8");
  }

  let migrationSQL: string;
  let normalizedSQL: string;

  beforeAll(() => {
    migrationSQL = readMigrationSQL();
    normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();
  });

  it("wraps the data update in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("targets only the five San Clemente spot profile slugs", () => {
    for (const slug of [
      "church",
      "cottons",
      "riviera",
      "t-street",
      "san-clemente-state-beach",
    ]) {
      expect(normalizedSQL).toContain(`'${slug}'`);
    }

    expect(normalizedSQL).toContain("where b.slug = profile.slug");
    expect(normalizedSQL).toContain("and b.deleted_at is null");
    expect(normalizedSQL).toContain("region = profile.region");
    expect(normalizedSQL).not.toContain("orange county / san diego county border");
  });

  it("does not move map pins owned by the prior spot-trust migration", () => {
    expect(migrationSQL).not.toMatch(/^\s*lat\s*,/m);
    expect(migrationSQL).not.toMatch(/^\s*lon\s*,/m);
    expect(normalizedSQL).not.toContain("lat = profile.lat");
    expect(normalizedSQL).not.toContain("lon = profile.lon");
    expect(normalizedSQL).not.toContain("33.379622288757");
    expect(normalizedSQL).not.toContain("33.39000832738053");
    expect(normalizedSQL).not.toContain("33.41800974113613");
    expect(normalizedSQL).not.toContain("33.40484417640326");
  });

  it("fills Riviera enough to avoid blank local-knowledge and condition panels", () => {
    expect(normalizedSQL).toContain("riviera is a south san clemente beachbreak");
    expect(normalizedSQL).toContain("swell_window_min_deg = profile.swell_window_min_deg");
    expect(normalizedSQL).toContain("swell_window_max_deg = profile.swell_window_max_deg");
    expect(normalizedSQL).toContain("wind_offshore_deg = profile.wind_offshore_deg");
    expect(normalizedSQL).toContain("preferred_tide_ft_min = profile.preferred_tide_ft_min");
    expect(normalizedSQL).toContain("preferred_tide_ft_max = profile.preferred_tide_ft_max");
    expect(normalizedSQL).toContain("parking_tips = profile.parking_tips");
    expect(normalizedSQL).toContain("access_tips = profile.access_tips");
    expect(normalizedSQL).toContain("crowd_tips = profile.crowd_tips");
  });

  it("replaces stale Church and Cottons San Onofre one-liners with nuanced Trestles-area copy", () => {
    expect(normalizedSQL).not.toContain("church is a beach break in san onofre");
    expect(normalizedSQL).not.toContain("cottons is a point break in san onofre");
    expect(normalizedSQL).toContain("san onofre / trestles-area");
    expect(normalizedSQL).toContain("san mateo point");
  });

  it("uses forecast-source values supported by the current CDIP station config", () => {
    expect(normalizedSQL).toContain("cdip_station = profile.cdip_station");
    expect(normalizedSQL).toContain("'45'::text");
    expect(normalizedSQL).not.toContain("'284'");
    expect(normalizedSQL).not.toContain("284::text");
  });

  it("does not approve or insert photo candidates without direct reusable asset URLs", () => {
    expect(normalizedSQL).not.toContain("insert into public.beach_photos");
    expect(normalizedSQL).not.toContain("approved = true");
    expect(normalizedSQL).not.toContain("set approved = true");
  });
});
