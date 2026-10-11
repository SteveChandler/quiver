import { readFileSync } from "node:fs";
import { join } from "node:path";

import { metadata } from "@/app/best-surf-forecast-app/page";

describe("Best surf forecast app SEO page", () => {
  it("uses capability-led metadata for paid and free best-app intent", () => {
    expect(metadata.title).toBe(
      "Best Surf App 2026: How to Choose a Surf Forecast App",
    );
    expect(metadata.description).toBe(
      "How to choose the best surf app in 2026: what to look for in forecasts, cams, alerts, and session logs, what surf apps cost, and where Quiver fits.",
    );
    expect(String(metadata.title).length).toBeLessThanOrEqual(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
    expect(metadata.keywords).toEqual(
      expect.arrayContaining([
        "best free surf forecast app",
        "free surf forecast app",
        "best free surf report app",
        "best surf app",
        "best surf apps",
        "surf forecast app",
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

  // Steven, 2026-10-11: compare by capability; never name other surf apps or
  // give them backlinks on this page. Internal /vs/* hrefs are fine.
  it("names no other surf app and links to none", () => {
    const pageDir = join(process.cwd(), "app/best-surf-forecast-app");
    const copy = ["page.tsx", "comparison-sources.ts"]
      .map((file) => readFileSync(join(pageDir, file), "utf8"))
      .join("\n")
      .replace(/href="\/vs\/surfline(\/free)?"/g, "");

    expect(copy).not.toMatch(
      /surfline|lazy ?surfer|swell ?scope|swellify|surf-forecast\.com|surf captain|surfcaptain|windy|magicseaweed|duune|blue ?verdict|swell intel/i,
    );
    const externalHosts = [...copy.matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map((match) => match[1]);
    expect(new Set(externalHosts)).toEqual(
      new Set(["schema.org", "www.ndbc.noaa.gov", "cdip.ucsd.edu"]),
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
