import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationSQL = readFileSync(
  path.join(root, "supabase/migrations/20260916200000_mexico_beach_editorial_copy.sql"),
  "utf8",
);
const copy: Record<
  string,
  {
    seo_title: string;
    seo_description: string;
    description: string;
    wave_tips: string;
    access_tips: string;
    best_conditions_prose: string;
  }
> = JSON.parse(
  readFileSync(
    path.join(root, "docs/imports/baja-surf-spots/2026-09-16/mexico-beach-copy.json"),
    "utf8",
  ),
);
const entries = Object.entries(copy);

describe("Mexico beach editorial copy migration", () => {
  it("is transactional and asserts every row matched a Mexico beach", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
    expect(migrationSQL).toContain(`IF matched <> ${entries.length} THEN`);
    expect(migrationSQL).toMatch(/b\.country = 'Mexico' AND b\.slug = c\.slug/);
  });

  it("does not approve pages for editorial indexing", () => {
    expect(migrationSQL).not.toMatch(/seo_indexable\s*=/i);
    expect(migrationSQL).not.toMatch(/editorial_reviewed_at\s*=/i);
  });

  it("covers every Mexico beach page with copy inside the column limits", () => {
    expect(entries).toHaveLength(113);
    for (const [slug, entry] of entries) {
      expect(migrationSQL).toContain(`'${slug}'`);
      expect(entry.seo_title.length).toBeGreaterThanOrEqual(10);
      expect(entry.seo_title.length).toBeLessThanOrEqual(60);
      expect(entry.seo_description.length).toBeGreaterThanOrEqual(50);
      expect(entry.seo_description.length).toBeLessThanOrEqual(160);
      expect(entry.description.trim()).not.toBe("");
      expect(entry.wave_tips.trim()).not.toBe("");
      expect(entry.access_tips.trim()).not.toBe("");
    }
  });

  it("keeps titles, meta descriptions and overviews unique", () => {
    for (const field of ["seo_title", "seo_description", "description"] as const) {
      const values = entries.map(([, entry]) => entry[field]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("inserts only licensed, attributed Wikimedia photos", () => {
    const photoBlock = migrationSQL.slice(migrationSQL.indexOf("INSERT INTO public.beach_photos"));
    expect(photoBlock).toContain("ON CONFLICT (beach_id, source, source_id) DO NOTHING");
    const rows = photoBlock.match(/^\s*\('[0-9a-f-]{36}'::uuid/gm) ?? [];
    expect(rows).toHaveLength(5);
    expect(photoBlock).not.toContain("openai-generated");
    const licenses = photoBlock.match(/'CC [A-Z0-9 .-]+'/g) ?? [];
    expect(licenses).toHaveLength(5);
    expect(licenses.filter((license) => /\b(NC|ND)\b/.test(license))).toEqual([]);
    expect(photoBlock.match(/via Wikimedia Commons/g)).toHaveLength(5);
  });
});
