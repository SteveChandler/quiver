import { readFileSync } from "node:fs";
import { join } from "node:path";

import { metadata } from "@/app/best-surf-forecast-app/page";

describe("Best surf forecast app SEO page", () => {
  it("uses capability-led metadata for the broad best-app intent", () => {
    expect(metadata.title).toBe("Best Surf Forecast App by Surf Job in 2026");
    expect(metadata.description).toBe(
      "A capability-led 2026 surf forecast app comparison: Quiver, Surfline, LazySurfer, Surf-Forecast.com, Surf Captain, Windy, and NDBC.",
    );
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
  });

  it("keeps source-backed disclosure and required internal links in the page copy", () => {
    const source = readFileSync(
      join(process.cwd(), "app/best-surf-forecast-app/page.tsx"),
      "utf8",
    );

    expect(source).toContain("Affiliation disclosure: Quiver is our app.");
    expect(source).toContain("COMPARISON_SOURCE_REVIEW.lastVerified");
    expect(source).toContain('href="/best-free-surf-forecast-app"');
    expect(source).toContain('href="/vs/surfline"');
    expect(source).toContain('href="/forecast-accuracy"');
    expect(source).toContain("Surf Captain");
    expect(source).toContain("https://surfcaptain.com/faq");
    expect(source).toContain('"@type": "ItemList"');
    expect(source).not.toContain('"@type": "SoftwareApplication"');
  });

  it("is reciprocally linked from the Surfline comparison page", () => {
    const source = readFileSync(
      join(process.cwd(), "app/vs/surfline/page.tsx"),
      "utf8",
    );

    expect(source).toContain('href="/best-surf-forecast-app"');
    expect(source).toContain("Compare surf forecast apps by job");
  });
});
