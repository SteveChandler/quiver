import { readFileSync } from "node:fs";

const PUBLIC_SEO_PAGES = [
  "app/[intent]/[city]/page.tsx",
  "app/[intent]/[city]/[beachSlug]/page.tsx",
  "app/[intent]/[city]/[beachSlug]/[intlBeachSlug]/page.tsx",
  "app/[intent]/[city]/[beachSlug]/tides/page.tsx",
  "app/[intent]/[city]/[beachSlug]/water-temp/page.tsx",
  "app/mexico/[region]/[city]/[beachSlug]/page.tsx",
  "app/mexico/[region]/[city]/[beachSlug]/tides/page.tsx",
  "app/mexico/[region]/[city]/[beachSlug]/water-temp/page.tsx",
];

const CANONICAL_BEACH_DETAIL_PAGES = [
  "app/[intent]/[city]/[beachSlug]/page.tsx",
  "app/[intent]/[city]/[beachSlug]/[intlBeachSlug]/page.tsx",
];

describe("major-event hold-sensitive pages", () => {
  it.each(PUBLIC_SEO_PAGES)(
    "keeps %s on ISR for crawler performance",
    (page) => {
      const source = readFileSync(page, "utf8");

      expect(source).toContain('export const dynamic = "force-static"');
      expect(source).toContain("export const revalidate = 3600");
      expect(source).not.toContain('export const dynamic = "force-dynamic"');
      expect(source).not.toContain("export const revalidate = 0");
    },
  );

  it("keeps the Mexico server render cookie-free", () => {
    const source = readFileSync(
      "app/mexico/[region]/[city]/[beachSlug]/page.tsx",
      "utf8",
    );

    expect(source).toContain("getSpotSurfReportPublic(beach)");
    expect(source).not.toContain("getSpotSurfReport(beach)");
  });

  it.each(CANONICAL_BEACH_DETAIL_PAGES)(
    "keeps one stable surf-forecast H1 and a secondary visual hero in %s",
    (page) => {
      const source = readFileSync(page, "utf8");

      expect(source).toContain('<PublicForecastAnswer');
      expect(source).toContain('headingLevel="h1"');
      expect(source).toContain('heroHeadingLevel="h2"');
      expect(source).toContain('<PublicForecastHourly');
      expect(source).toContain('forecastDay={hourlyForecastDay}');
    },
  );
});
