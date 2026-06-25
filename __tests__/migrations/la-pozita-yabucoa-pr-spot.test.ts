import { readFileSync } from "fs";
import { join } from "path";

describe("La Pozita Yabucoa Puerto Rico spot migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260625090000_add_la_pozita_yabucoa_pr_spot.sql",
    ),
    "utf8",
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the seed data in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("adds La Pozita idempotently as a Yabucoa spot", () => {
    expect(normalizedSQL).toContain("'la pozita'");
    expect(normalizedSQL).toContain("'la-pozita-yabucoa-pr'");
    expect(normalizedSQL).toContain("'la posita'");
    expect(normalizedSQL).toContain("'la pocita'");
    expect(normalizedSQL).toContain("'yabucoa'");
    expect(normalizedSQL).toContain("'pr'");
    expect(normalizedSQL).toContain("where not exists");
    expect(normalizedSQL).toContain("existing.state = spot.state");
    expect(normalizedSQL).toContain("existing.city = spot.city");
    expect(normalizedSQL).toContain("existing.slug = spot.slug");
    expect(normalizedSQL).toContain("existing.deleted_at is null");
  });

  it("keeps research status conservative without public calibration copy", () => {
    expect(normalizedSQL).toContain("local-research-only");
    expect(normalizedSQL).not.toContain("local-confirmation-needed");
    expect(normalizedSQL).not.toContain("needs surfer session calibration");
    expect(normalizedSQL).not.toContain("pin and scoring");
    expect(normalizedSQL).not.toContain("pin/scoring");
    expect(normalizedSQL).not.toContain("local session confirmation");
    expect(normalizedSQL).not.toContain("session logs tune");
    expect(normalizedSQL).toContain("more organized sets");
    expect(normalizedSQL).toContain("less shorebreak than main el cocal");
  });

  it("seeds conservative safety and condition data", () => {
    expect(normalizedSQL).toContain("'intermediate'");
    expect(normalizedSQL).toContain("'reef'");
    expect(normalizedSQL).toContain("'rocks'");
    expect(normalizedSQL).toContain("'sea urchins'");
    expect(normalizedSQL).toContain("'rip currents'");
    expect(normalizedSQL).toContain("'no lifeguard'");
    expect(normalizedSQL).toContain("'america/puerto_rico'");
  });

  it("adds only a representative licensed Wikimedia photo and no camera source", () => {
    expect(normalizedSQL).toContain("insert into public.beach_photos");
    expect(normalizedSQL).toContain(
      "'file:el guano beach in camino nuevo, yabucoa, puerto rico.jpg'",
    );
    expect(normalizedSQL).toContain("'wikimedia'");
    expect(normalizedSQL).toContain("'cc by-sa 2.0'");
    expect(normalizedSQL).toContain("representative el cocal-area photo");
    expect(normalizedSQL).toContain(
      "on conflict (beach_id, source, source_id)",
    );
    expect(normalizedSQL).not.toContain("beach_sources");
    expect(normalizedSQL).not.toContain("camera_url");
  });
});
