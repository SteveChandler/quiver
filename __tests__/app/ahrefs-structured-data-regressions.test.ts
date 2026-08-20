import { readFileSync } from "node:fs";
import { join } from "node:path";

const NON_APP_LANDING_PAGES = [
  "app/for-businesses/page.tsx",
  "app/for-surf-schools/page.tsx",
  "app/free-surf-reports/page.tsx",
  "app/vs/surfline/page.tsx",
  "app/vs/surfline/free/page-content.tsx",
];

describe("Ahrefs structured-data regressions", () => {
  it.each(NON_APP_LANDING_PAGES)(
    "does not emit ineligible SoftwareApplication markup from %s",
    (relativePath) => {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");

      expect(source).not.toContain('"@type": "SoftwareApplication"');
      expect(source).not.toContain('type="softwareApplication"');
    },
  );

  it("keeps the eligible app page rating and an explicit offer price", () => {
    const source = readFileSync(
      join(process.cwd(), "app/best-surf-forecast-app/page.tsx"),
      "utf8",
    );

    expect(source).toContain('"@type": "SoftwareApplication"');
    expect(source).toContain("aggregateRating:");
    expect(source).toMatch(
      /"@type": "Offer",\s+price: "0",\s+priceCurrency: "USD"/,
    );
    expect(source).not.toContain('"@type": "AggregateOffer"');
  });
});
