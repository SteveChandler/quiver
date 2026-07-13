import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260712230000_complete_oahu_beach_catalog.sql",
);

const NEW_SLUGS = [
  "makaha",
  "white-plains",
  "laniakea",
  "chuns-reef",
  "tracks",
  "kewalo-basin",
  "rocky-point",
  "off-the-wall",
  "makapuu",
  "publics",
  "velzyland",
  "backyards",
  "pops",
  "threes",
  "kaisers",
  "puaena-point",
] as const;

describe("Oahu beach catalog migration", () => {
  const sql = (): string => readFileSync(MIGRATION, "utf8");

  it("seeds the approved 16-spot catalog exactly once", () => {
    const migration = sql();

    expect(migration).toMatch(/^BEGIN;/m);
    expect(migration).toMatch(/COMMIT;\s*$/m);
    expect(migration).toContain("WHERE NOT EXISTS");
    expect(migration).not.toMatch(/^\s*(?:DELETE|TRUNCATE|DROP)\b/im);

    for (const slug of NEW_SLUGS) {
      expect(migration.match(new RegExp(`'${slug}'`, "g"))).toHaveLength(1);
    }
  });

  it("seeds complete public forecast-anchor metadata", () => {
    const migration = sql();

    for (const column of [
      "lat",
      "lon",
      "timezone",
      "preferred_tide_direction",
      "swell_window_center_deg",
      "swell_window_halfwidth_deg",
      "persona",
      "deepwater_decay_factor",
      "description",
      "parking_tips",
      "access_tips",
      "wave_tips",
      "crowd_tips",
      "best_conditions_prose",
      "local_etiquette",
    ]) {
      expect(migration).toContain(column);
    }

    expect(migration).toContain("Pacific/Honolulu");
    expect(migration).not.toMatch(/INSERT INTO public\.beaches \([\s\S]*?\bgeog\b/);
    expect(migration).toMatch(/is_private[\s\S]*false/i);
  });

  it("renames Haleiwa in place without changing its id or slug", () => {
    const migration = sql();

    expect(migration).toMatch(/UPDATE public\.beaches[\s\S]*Haleʻiwa Aliʻi Beach/);
    expect(migration).toMatch(/WHERE id = '43cfaf0d-0376-45cb-a8bd-78087ba4ee15'/);
    expect(migration).toMatch(/AND slug = 'haleiwa'/);
  });

  it("publishes only the validated Ala Moana YouTube camera and no photos", () => {
    const migration = sql();

    expect(migration).toMatch(/INSERT INTO public\.beach_sources/i);
    expect(migration).toContain("https://www.youtube.com/watch?v=Bk2qxqAill8");
    expect(migration).toContain("@wozereme");
    expect(migration.match(/INSERT INTO public\.beach_sources/gi)).toHaveLength(1);
    expect(migration).not.toMatch(/INSERT INTO public\.beach_photos/i);
  });
});
