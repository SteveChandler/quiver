import { readFileSync } from "node:fs";

const HOLD_SENSITIVE_PAGES = [
  "app/[intent]/[city]/page.tsx",
  "app/[intent]/[city]/[beachSlug]/page.tsx",
  "app/mexico/[region]/[city]/[beachSlug]/page.tsx",
];

describe("major-event hold-sensitive pages", () => {
  it.each(HOLD_SENSITIVE_PAGES)(
    "keeps %s dynamic across scheduled hold transitions",
    (page) => {
      const source = readFileSync(page, "utf8");

      expect(source).toContain('export const dynamic = "force-dynamic"');
      expect(source).toContain("export const revalidate = 0");
      expect(source).not.toContain("export const revalidate = 3600");
    },
  );
});
