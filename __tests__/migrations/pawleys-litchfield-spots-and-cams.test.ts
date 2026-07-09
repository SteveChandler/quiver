import { readFileSync } from "fs";
import { join } from "path";

describe("Pawleys and South Litchfield seed migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260702030000_add_pawleys_litchfield_spots_and_cams.sql",
    ),
    "utf8",
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the seed in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("adds the two Grand Strand forecast anchors with surf preference data", () => {
    expect(normalizedSQL).toContain("insert into public.beaches");
    expect(normalizedSQL).toContain("'pawleys-island-pier-pawleys-island-sc'");
    expect(normalizedSQL).toContain("'south-litchfield-litchfield-beach-sc'");
    expect(normalizedSQL).toContain("swell_window_min_deg");
    expect(normalizedSQL).toContain("swell_window_max_deg");
    expect(normalizedSQL).toContain("preferred_tide_direction");
    expect(normalizedSQL).toContain("private pier/access caveat");
    expect(normalizedSQL).toContain("litchfield by the sea");
  });

  it("adds the validated owner cam URLs", () => {
    expect(normalizedSQL).toContain("insert into public.beach_sources");
    expect(normalizedSQL).toContain(
      "'https://live5.brownrice.com:444/pawleys1/pawleys1.stream/playlist.m3u8'",
    );
    expect(normalizedSQL).toContain(
      "'https://g1.ipcamlive.com/player/player.php?alias=southbeachcam&skin=white&autoplay=1'",
    );
    expect(normalizedSQL).toContain("on conflict (beach_id)");
    expect(normalizedSQL).toContain("beach_sources.camera_url is null");
    expect(normalizedSQL).toContain("beach_sources.camera_url = ''");
    expect(normalizedSQL).toContain("beach_sources.camera_url = excluded.camera_url");
  });

  it("remaps only Landon's affected custom spots from the stale Isle of Palms anchor", () => {
    expect(normalizedSQL).toContain("update public.custom_spots as cs");
    expect(normalizedSQL).toContain("'ea66c1be-ea12-4606-8430-d17271f053d3'::uuid");
    expect(normalizedSQL).toContain("'7e65605a-d260-45d7-ba9b-59476ee1bfd8'::uuid");
    expect(normalizedSQL).toContain("'99c8b745-a3d8-4248-be97-7691a31fafa3'::uuid");
    expect(normalizedSQL).toContain("'d15efc29-c4cb-407c-99b8-be92914473f4'::uuid");
    expect(normalizedSQL).toContain("cs.deleted_at is null");
    expect(normalizedSQL).not.toContain("profiles");
    expect(normalizedSQL).not.toContain("where user_id");
  });

  it("does not contain destructive data operations", () => {
    expect(normalizedSQL).not.toMatch(/\bdelete\s+from\b/);
    expect(normalizedSQL).not.toMatch(/\btruncate\b/);
    expect(normalizedSQL).not.toMatch(/\bdrop\s+table\b/);
  });
});
