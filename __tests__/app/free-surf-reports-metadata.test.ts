import { readFileSync } from "node:fs";
import { join } from "node:path";

import { metadata } from "@/app/free-surf-reports/page";

describe("Free surf reports SEO metadata", () => {
  it("targets free surf report intent with a concise SERP description", () => {
    expect(metadata.title).toBe("Free Surf Reports, Forecasts & Conditions");
    expect(metadata.description).toBe(
      "Free surf reports for 279+ beaches with wave height, swell period, wind, tide, water temp, crowd intel, and best surf windows.",
    );
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);

    const openGraphImages = metadata.openGraph?.images;
    expect(Array.isArray(openGraphImages)).toBe(true);
    expect((openGraphImages as Array<{ url: string }>)[0]?.url).toContain(
      "/images/seo-scenes/la-jolla-scripps-clean.webp",
    );
  });

  it("keeps free positioning and coverage proof visible in page copy", () => {
    const source = readFileSync(
      join(process.cwd(), "app/free-surf-reports/page.tsx"),
      "utf8",
    );

    expect(source).toContain("Free Surf Reports");
    expect(source).toContain("279+ beaches");
    expect(source).toContain("$0 forecast paywall");
    expect(source).toContain("without a forecast paywall");
    expect(source).toContain(
      "href: \"/best-surf-forecast-app#best-free-surf-forecast-app\"",
    );
    expect(source).toContain("href: \"/vs/surfline/free\"");
    expect(source).toContain("href: \"/features\"");
    expect(source).not.toContain("\"@type\": \"SoftwareApplication\"");
    expect(source).toContain("<WebPageSchema");
  });
});
