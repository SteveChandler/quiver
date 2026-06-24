import { readFileSync } from "fs";
import { join } from "path";

describe("El Cocal and Inches Puerto Rico spot migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260624033000_add_el_cocal_inches_pr_spots.sql",
    ),
    "utf8",
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the seed data in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("adds the researched southeast Puerto Rico spots idempotently", () => {
    for (const slug of ["el-cocal-yabucoa-pr", "inches-patillas-pr"]) {
      expect(normalizedSQL).toContain(`'${slug}'`);
    }

    expect(normalizedSQL).toContain("where not exists");
    expect(normalizedSQL).toContain("existing.state = spot.state");
    expect(normalizedSQL).toContain("existing.city = spot.city");
    expect(normalizedSQL).toContain("existing.slug = spot.slug");
    expect(normalizedSQL).toContain("existing.deleted_at is null");
  });

  it("keeps the researched safety and condition profiles explicit", () => {
    expect(normalizedSQL).toContain("'yabucoa'");
    expect(normalizedSQL).toContain("'patillas'");
    expect(normalizedSQL).toContain("'lower-intermediate'");
    expect(normalizedSQL).toContain("'shallow reef'");
    expect(normalizedSQL).toContain("'fire coral'");
    expect(normalizedSQL).toContain("'no lifeguard'");
    expect(normalizedSQL).toContain("'america/puerto_rico'");
  });

  it("adds only licensed Wikimedia photos", () => {
    expect(normalizedSQL).toContain("insert into public.beach_photos");
    expect(normalizedSQL).toContain(
      "'file:el guano beach in camino nuevo, yabucoa, puerto rico.jpg'",
    );
    expect(normalizedSQL).toContain("'file:inches beach (2025)-1.jpg'");
    expect(normalizedSQL).toContain("'wikimedia'");
    expect(normalizedSQL).toContain("'cc by-sa 2.0'");
    expect(normalizedSQL).toContain("'cc by 4.0'");
    expect(normalizedSQL).toContain(
      "on conflict (beach_id, source, source_id)",
    );
  });

  it("does not seed unvalidated or dead camera URLs", () => {
    expect(normalizedSQL).not.toContain("beach_sources");
    expect(normalizedSQL).not.toContain("click2stream");
    expect(normalizedSQL).not.toContain("el-marullo-inches-cam");
  });
});
