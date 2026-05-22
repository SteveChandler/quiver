import { readdirSync, readFileSync } from "fs";
import { join } from "path";

describe("SoCal sandy beginner coverage migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_expand_socal_sandy_beginner_coverage\.sql$/.test(filename),
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

  it("wraps the local data update in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("adds only missing Blackies with researched surf-zone coordinates", () => {
    expect(normalizedSQL).toContain("'blackies'");
    expect(normalizedSQL).toContain("33.60905");
    expect(normalizedSQL).toContain("-117.93205");
    expect(normalizedSQL).toContain("insert_if_missing = true");
    expect(normalizedSQL).toContain("where insert_if_missing = true");
    expect(normalizedSQL).toContain("where b.deleted_at is null");
    expect(normalizedSQL).toContain("not exists");
    expect(normalizedSQL).toContain("coalesce(b.lat, profile.lat)");
    expect(normalizedSQL).toContain("coalesce(b.lon, profile.lon)");
    expect(normalizedSQL).not.toContain("33.6103");
    expect(normalizedSQL).not.toContain("-117.9289");
    expect(migrationSQL.match(/^\s+33\.\d+,\s*$/gm)).toEqual([
      "    33.60905,",
    ]);
    expect(migrationSQL.match(/^\s+-117\.\d+,\s*$/gm)).toEqual([
      "    -117.93205,",
    ]);
    expect(migrationSQL.match(/^\s+-118\.\d+,\s*$/gm)).toBeNull();
  });

  it("enriches detailed SoCal sandy beginner editorial profiles", () => {
    for (const name of [
      "blackies",
      "bolsa chica state beach",
      "huntington state beach",
      "goldenwest",
      "seal beach pier",
      "doheny state beach",
      "old man''s (sano)",
      "la jolla shores",
      "tourmaline beach",
      "santa monica beach",
      "venice beach",
      "dockweiler state beach",
      "will rogers state beach",
      "torrance beach (rat beach)",
      "mondos beach",
    ]) {
      expect(normalizedSQL).toContain(name);
    }
  });

  it("classifies broader current SoCal candidates as primary, conditional, or no", () => {
    expect(normalizedSQL).toContain(
      "create temp table temp_socal_sandy_beginner_classifications",
    );
    expect(normalizedSQL).toContain("check (beginner_fit in");

    for (const fit of ["'primary'", "'conditional'", "'no'"]) {
      expect(normalizedSQL).toContain(fit);
    }

    for (const name of [
      "mission beach (central)",
      "pacific beach",
      "moonlight state beach",
      "el porto (manhattan)",
      "72nd place",
      "leo carrillo state beach",
      "zuma beach",
      "refugio state beach",
      "solimar reef",
    ]) {
      expect(normalizedSQL).toContain(name);
    }
  });

  it("keeps unsafe or weakly sourced rows out of beginner promotion", () => {
    for (const name of [
      "newland st.",
      "huntington st.",
      "hb cliffs",
      "salt creek",
      "strands",
      "newport lower jetties",
      "river jetties",
      "marine street beach",
      "middles",
      "trails",
    ]) {
      expect(normalizedSQL).toContain(name);
    }

    expect(normalizedSQL).toContain("'exclude_from_beginner'");
    expect(normalizedSQL).toContain('"beginner_fit":"no"');
    expect(normalizedSQL).toContain("lower jetties out of beginner promotion");
    expect(normalizedSQL).toContain("marine street out of sandy beginner");
    expect(normalizedSQL).toContain("middles out of sandy beginner promotion");
  });

  it("stores the shared sandy beginner-window model in preference_model", () => {
    expect(normalizedSQL).toContain("'beginner_window'");
    expect(normalizedSQL).toContain("'sandy_beginner_inventory'");
    expect(normalizedSQL).toContain("'scope', 'southern_california'");
    expect(normalizedSQL).toContain("socal_sandy_beginner");
    expect(normalizedSQL).toContain('"ideal_wave_height_ft":{"min":1,"max":2}');
    expect(normalizedSQL).toContain(
      '"acceptable_wave_height_ft":{"min":0.5,"max":3}',
    );
    expect(normalizedSQL).toContain(
      '"preferred_tide_stage":["low","rising","mid"]',
    );
    expect(normalizedSQL).toContain(
      '"best_time_local":{"start":"06:00","end":"10:00"}',
    );
    expect(normalizedSQL).toContain('"avoid_high_tide_under_ft":2');
  });

  it("does not invent exact tide-foot ranges from wave-height research", () => {
    expect(normalizedSQL).toContain(
      "preferred_tide_ft_min = coalesce(profile.preferred_tide_ft_min, b.preferred_tide_ft_min)",
    );
    expect(normalizedSQL).toContain(
      "preferred_tide_ft_max = coalesce(profile.preferred_tide_ft_max, b.preferred_tide_ft_max)",
    );
    expect(normalizedSQL).toContain(
      "preferred_tide_direction = coalesce(profile.preferred_tide_direction, b.preferred_tide_direction)",
    );
    expect(normalizedSQL).not.toContain(
      "preferred_tide_ft_min = profile.preferred_tide_ft_min",
    );
    expect(normalizedSQL).not.toContain(
      "preferred_tide_ft_max = profile.preferred_tide_ft_max",
    );
  });

  it("keeps wind thresholds in beginner_window metadata instead of beach columns", () => {
    expect(normalizedSQL).toContain("max_wind_any_mph integer");
    expect(normalizedSQL).toContain("max_wind_onshore_mph integer");
    expect(normalizedSQL).toContain('"max_beginner_wind_mph":10');
    expect(normalizedSQL).not.toContain(
      "max_wind_any_mph = profile.max_wind_any_mph",
    );
    expect(normalizedSQL).not.toContain(
      "max_wind_onshore_mph = profile.max_wind_onshore_mph",
    );
    expect(normalizedSQL).not.toMatch(
      /insert into public\.beaches \([\s\S]*?max_wind_any_mph/,
    );
    expect(normalizedSQL).not.toMatch(
      /insert into public\.beaches \([\s\S]*?max_wind_onshore_mph/,
    );
  });

  it("writes beginner editorial JSON for public pages", () => {
    expect(normalizedSQL).toContain(
      "insert into public.beach_editorial_content",
    );
    expect(normalizedSQL).toContain("'beginner_notes'");
    expect(normalizedSQL).toContain("'why_beginners_love_it'");
    expect(normalizedSQL).toContain(
      "'best_hours', '6-10am, earlier if possible'",
    );
    expect(normalizedSQL).toContain(
      "southern california sandy learner rule is small, clean, early, and low-to-mid tide",
    );
  });

  it("carries the researched source buckets into preference metadata", () => {
    for (const source of [
      "wannasurf.com/spot/north_america/usa/california/orange_county/blackies",
      "surfline.com/surf-report/blackies",
      "parks.ca.gov/bolsachica",
      "parks.ca.gov/huntington",
      "parks.ca.gov/?page_id=645",
      "parks.ca.gov/?page_id=647",
      "theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county",
      "sandiegosurfrental.com/surf-spot-education",
      "sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles",
      "beaches.lacounty.gov/dockweiler-beach",
      "beaches.lacounty.gov/will-rogers-beach",
      "surfspots.co/spot/mondos",
      "santabarbarasurfschool.com/surf-locations",
    ]) {
      expect(normalizedSQL).toContain(source);
    }
  });

  it("keeps anon-capture SQL presets in sync with explicit sandy beginner alert rules", () => {
    expect(normalizedSQL).toContain(
      "create or replace function public.preset_default_conditions",
    );
    expect(normalizedSQL).toContain("'beginner_sandy_window'");
    expect(normalizedSQL).toContain("'avoid_tide_statuses'");
    expect(normalizedSQL).toContain("'local_time_start'");
    expect(normalizedSQL).toContain("'local_time_end'");
    expect(normalizedSQL).toContain("0.868976");
    expect(normalizedSQL).toContain(
      "v_beginner_window is not null and v_beginner_fit in ('primary', 'conditional')",
    );
    expect(normalizedSQL).toContain(
      "lower(coalesce(b.preference_model #>> '{beginner_window,beginner_fit}', '')) in ('primary', 'conditional')",
    );
    expect(normalizedSQL).not.toContain(
      "not (coalesce(b.preference_model, '{}'::jsonb) ? 'beginner_window')",
    );
    expect(normalizedSQL).not.toContain(
      "coalesce(v_beginner_fit, '') <> 'no'",
    );
    expect(normalizedSQL).not.toContain("v_features_text like '%beginner%'");
    expect(normalizedSQL).toContain("v_effective_tide_min := coalesce");
    expect(normalizedSQL).toContain(
      "v_beginner_window ->> 'preferred_tide_ft_min'",
    );
    expect(normalizedSQL).toContain("v_effective_tide_max := coalesce");
    expect(normalizedSQL).toContain(
      "v_beginner_window ->> 'preferred_tide_ft_max'",
    );
  });

  it("backfills only legacy mellow_session rules for sandy beginner beaches", () => {
    expect(normalizedSQL).toContain("update public.alert_rules");
    expect(normalizedSQL).toContain("r.preset_type = 'mellow_session'");
    expect(normalizedSQL).toContain("sandy_beginner_beaches");
    expect(normalizedSQL).toContain("legacy_mellow_rules");
    expect(normalizedSQL).toContain("jsonb_object_keys");
    expect(normalizedSQL).toContain("condition_key not in");
    expect(normalizedSQL).toContain("'swell_height_min'");
    expect(normalizedSQL).toContain("'swell_height_max'");
    expect(normalizedSQL).toContain("'wind_speed_max_kt'");
    expect(normalizedSQL).toContain("b.preferred_tide_ft_min is not null");
    expect(normalizedSQL).toContain("b.preferred_tide_ft_max is not null");
  });
});
