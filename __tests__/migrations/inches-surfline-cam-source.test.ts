import { readFileSync } from "fs";
import { join } from "path";

describe("Inches Surfline cam source migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260625101000_add_inches_surfline_cam_source.sql",
    ),
    "utf8",
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the source update in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("adds the approved Surfline HLS cam and still for Inches only", () => {
    expect(normalizedSQL).toContain("insert into public.beach_sources");
    expect(normalizedSQL).toContain("thumbnail_url");
    expect(normalizedSQL).toContain("'inches-patillas-pr'");
    expect(normalizedSQL).toContain("'patillas'");
    expect(normalizedSQL).toContain(
      "'https://hls.cdn-surfline.com/ohio/pr-inches/playlist.m3u8'",
    );
    expect(normalizedSQL).toContain(
      "'https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg'",
    );
    expect(normalizedSQL).not.toContain("'el-cocal-yabucoa-pr'");
    expect(normalizedSQL).not.toContain("'la-pozita-yabucoa-pr'");
  });

  it("does not reintroduce stale camera URLs", () => {
    expect(normalizedSQL).not.toContain("el-marullo-inches-cam.click2stream.com");
    expect(normalizedSQL).not.toContain("www.comoestaeso.com");
  });

  it("only replaces blank, same, or known-dead camera rows", () => {
    expect(normalizedSQL).toContain("on conflict (beach_id)");
    expect(normalizedSQL).toContain("camera_url = excluded.camera_url");
    expect(normalizedSQL).toContain("beach_sources.camera_url is null");
    expect(normalizedSQL).toContain("beach_sources.camera_url = ''");
    expect(normalizedSQL).toContain("beach_sources.camera_url = excluded.camera_url");
    expect(normalizedSQL).toContain(
      "beach_sources.camera_url = 'https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67'",
    );
    expect(normalizedSQL).toContain("beach_sources.camera_url ilike '%click2stream%'");
    expect(normalizedSQL).toContain("beach_sources.camera_url ilike '%comoestaeso%'");
    expect(normalizedSQL).toContain(
      "thumbnail_url = coalesce(nullif(public.beach_sources.thumbnail_url, ''), excluded.thumbnail_url)",
    );
  });

  it("updates the Inches takeaway so it no longer says no camera exists", () => {
    expect(normalizedSQL).toContain("approved surfline cam link available");
    expect(normalizedSQL).toContain("array_replace");
    expect(normalizedSQL).toContain("no validated public live camera found");
  });
});
