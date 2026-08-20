import { readFileSync } from "node:fs";
import { join } from "node:path";

import { metadata } from "@/app/best-surf-forecast-app/page";

describe("Best surf forecast app SEO page", () => {
  it("uses capability-led metadata for paid and free best-app intent", () => {
    expect(metadata.title).toBe(
      "Best Surf Forecast Apps: Free & Paid Picks for 2026",
    );
    expect(metadata.description).toBe(
      "Compare the best paid and free surf forecast apps for 2026, including Quiver, Surfline, Windy, and more, with clear free-tier limits.",
    );
    expect(String(metadata.title).length).toBeLessThanOrEqual(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
    expect(metadata.keywords).toEqual(
      expect.arrayContaining([
        "best free surf forecast app",
        "free surf forecast app",
        "best free surf report app",
      ]),
    );
  });

  it("keeps source-backed disclosure and required internal links in the page copy", () => {
    const source = readFileSync(
      join(process.cwd(), "app/best-surf-forecast-app/page.tsx"),
      "utf8",
    );

    expect(source).toContain("Affiliation disclosure: Quiver is our app.");
    expect(source).toContain("COMPARISON_SOURCE_REVIEW.lastVerified");
    expect(source).toContain('href="#best-free-surf-forecast-app"');
    expect(source).toContain('href="/vs/surfline"');
    expect(source).toContain('href="/forecast-accuracy"');
    expect(source).toContain("Surf Captain");
    expect(source).toContain("https://surfcaptain.com/faq");
    expect(source).toContain('"@type": "ItemList"');
    expect(source).toContain('"@type": "FAQPage"');
    // 2026-08-19: /best-free-surf-forecast-app was consolidated into this page,
    // so this page inherited the "eligible app page" role. It is now the ONLY page
    // allowed to emit SoftwareApplication, and it must carry the aggregateRating +
    // Offer that make the markup rich-result eligible.
    expect(source).toContain('"@type": "SoftwareApplication"');
    expect(source).toContain("aggregateRating:");
    expect(source).toMatch(
      /"@type": "Offer",\s+price: "0",\s+priceCurrency: "USD"/,
    );
    expect(source).toContain("What is the best free surf forecast app?");
    expect(source).toContain("Can I use Quiver without paying?");
    expect(source).toContain("one watched beach with up to three alert rules");
    expect(source).toContain(
      "Pro only: personal match score, ranked session windows, and personal alerts.",
    );
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
