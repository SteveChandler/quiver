import { readdirSync, readFileSync } from "fs";
import { join } from "path";

describe("Huntington beginner coverage migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_expand_huntington_beginner_coverage\.sql$/.test(filename),
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

  it("adds Blackies without blindly duplicating existing beach rows", () => {
    expect(normalizedSQL).toContain("'blackies'");
    expect(normalizedSQL).toContain("insert_if_missing = true");
    expect(normalizedSQL).toContain("where insert_if_missing = true");
    expect(normalizedSQL).toContain("where b.deleted_at is null");
    expect(normalizedSQL).toContain("not exists");
    expect(normalizedSQL).toContain("newport pier northside");
  });

  it("enriches the Huntington and nearby beginner candidate set", () => {
    for (const name of [
      "bolsa chica state beach",
      "huntington state beach",
      "north hb streets",
      "huntington beach pier northside",
      "huntington beach pier southside",
      "newland st.",
      "huntington st.",
      "hb cliffs",
      "seal beach pier",
    ]) {
      expect(normalizedSQL).toContain(name);
    }

    expect(normalizedSQL).toContain("goldenwest");
    expect(normalizedSQL).toContain("'goldenwest'");
    expect(normalizedSQL).toContain("17th street");
    expect(normalizedSQL).toContain("20th street");
    expect(normalizedSQL).toContain("newland st.");
  });

  it("stores the shared sandy beginner-window model in preference_model", () => {
    expect(normalizedSQL).toContain("'beginner_window'");
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

  it("keeps non-primary Huntington zones out of blanket beginner promotion", () => {
    expect(normalizedSQL).toContain("'conditional'");
    expect(normalizedSQL).toContain("'exclude_from_beginner'");
    expect(normalizedSQL).toContain('"beginner_fit":"no"');
    expect(normalizedSQL).toContain("not a primary beginner recommendation");
    expect(normalizedSQL).toContain("public evidence is too thin");
    expect(normalizedSQL).toContain("not a public beginner recommendation");
    expect(normalizedSQL).toContain("hb cliffs should generally be excluded");
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
    expect(normalizedSQL).toContain("small, clean, early, and low-to-mid tide");
  });

  it("carries official and local research sources into preference metadata", () => {
    expect(normalizedSQL).toContain("newportbeachca.gov");
    expect(normalizedSQL).toContain("parks.ca.gov/bolsachica");
    expect(normalizedSQL).toContain("huntingtonbeachca.gov");
    expect(normalizedSQL).toContain("sealbeachca.gov");
    expect(normalizedSQL).toContain("surfing-waves.com");
    expect(normalizedSQL).toContain("wavehuggers.com");
  });

  it("keeps anon-capture SQL presets in sync with sandy beginner alert rules", () => {
    expect(normalizedSQL).toContain(
      "create or replace function public.preset_default_conditions",
    );
    expect(normalizedSQL).toContain("'beginner_sandy_window'");
    expect(normalizedSQL).toContain("'avoid_tide_statuses'");
    expect(normalizedSQL).toContain("'local_time_start'");
    expect(normalizedSQL).toContain("'local_time_end'");
    expect(normalizedSQL).toContain("0.868976");
    expect(normalizedSQL).toContain("v_effective_tide_min := coalesce");
    expect(normalizedSQL).toContain("v_beginner_window ->> 'preferred_tide_ft_min'");
    expect(normalizedSQL).toContain("v_effective_tide_max := coalesce");
    expect(normalizedSQL).toContain("v_beginner_window ->> 'preferred_tide_ft_max'");
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
