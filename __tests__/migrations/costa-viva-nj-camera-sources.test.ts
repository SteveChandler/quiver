import { readFileSync } from "fs";
import { join } from "path";

describe("Costa Viva NJ camera source migration", () => {
  const migrationSQL: string = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260702183000_upsert_costa_viva_nj_camera_sources.sql",
    ),
    "utf8",
  );
  const normalizedSQL: string = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the upsert in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("upserts only the approved Costa Viva overlap camera rows", () => {
    expect(normalizedSQL).toContain("insert into public.beach_sources");
    expect(normalizedSQL).toContain("'sandy-hook-sandy-hook-nj'");
    expect(normalizedSQL).toContain("'asbury-park-asbury-park-nj'");
    expect(normalizedSQL).toContain("'long-branch-long-branch-nj'");
    expect(normalizedSQL).toContain("'belmar-belmar-nj'");
    expect(normalizedSQL).toContain("'kook-bay-spring-lake-nj'");

    expect(normalizedSQL).not.toContain("'8th-avenue-jetty-belmar-nj'");
    expect(normalizedSQL).not.toContain("'manasquan-inlet-manasquan-nj'");
    expect(normalizedSQL).not.toContain("'seaside-park-seaside-park-nj'");
    expect(normalizedSQL).not.toContain("'bay-head-beach-bay-head-nj'");
  });

  it("uses public provider URLs and thumbnails for approved sources", () => {
    expect(normalizedSQL).toContain(
      "'https://www.youtube.com/watch?v=iditvhzt9hm'",
    );
    expect(normalizedSQL).toContain(
      "'https://v.angelcam.com/iframe?v=oxrndg4dl8&autoplay=1'",
    );
    expect(normalizedSQL).toContain(
      "'https://www.youtube.com/watch?v=4iczwsqnup8'",
    );
    expect(normalizedSQL).toContain(
      "'https://www.youtube.com/watch?v=brz7t3aqagq'",
    );
    expect(normalizedSQL).toContain(
      "'https://www.youtube.com/watch?v=pf-qrjm1__y'",
    );
    expect(normalizedSQL).toContain(
      "'https://img.youtube.com/vi/iditvhzt9hm/hqdefault.jpg'",
    );
  });

  it("preserves strict camera overwrite rules", () => {
    expect(normalizedSQL).toContain("on conflict (beach_id)");
    expect(normalizedSQL).toContain("public.beach_sources.camera_url is null");
    expect(normalizedSQL).toContain("public.beach_sources.camera_url = ''");
    expect(normalizedSQL).toContain(
      "public.beach_sources.camera_url = excluded.camera_url",
    );
    expect(normalizedSQL).toContain(
      "thumbnail_url = coalesce(nullif(public.beach_sources.thumbnail_url, ''), excluded.thumbnail_url)",
    );
  });

  it("does not contain destructive data operations or ingestion changes", () => {
    expect(normalizedSQL).not.toMatch(/\bdelete\s+from\b/);
    expect(normalizedSQL).not.toMatch(/\btruncate\b/);
    expect(normalizedSQL).not.toMatch(/\bdrop\s+table\b/);
    expect(normalizedSQL).not.toContain("enhanced_forecasts");
    expect(normalizedSQL).not.toContain("forecast_at");
  });
});
