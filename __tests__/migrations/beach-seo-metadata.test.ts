import { readFileSync } from "node:fs";
import path from "node:path";

const migrationSQL = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260916190000_add_beach_seo_metadata.sql",
  ),
  "utf8",
);

describe("beach SEO metadata migration", () => {
  it("is transactional and adds nullable SEO columns", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
    expect(migrationSQL).toMatch(/ADD COLUMN IF NOT EXISTS seo_title text/i);
    expect(migrationSQL).toMatch(/ADD COLUMN IF NOT EXISTS seo_description text/i);
  });

  it("guards length constraints for repeatable application", () => {
    expect(migrationSQL).toMatch(/IF NOT EXISTS[\s\S]+beaches_seo_title_length_check/i);
    expect(migrationSQL).toMatch(/seo_title IS NULL OR char_length\(seo_title\) BETWEEN 10 AND 60/i);
    expect(migrationSQL).toMatch(/IF NOT EXISTS[\s\S]+beaches_seo_description_length_check/i);
    expect(migrationSQL).toMatch(/seo_description IS NULL OR char_length\(seo_description\) BETWEEN 50 AND 160/i);
  });
});
