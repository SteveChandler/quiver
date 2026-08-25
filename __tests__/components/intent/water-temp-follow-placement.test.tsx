import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("bounded water-temperature follow pilot placement", () => {
  it("keeps the dedicated city answer first and follow before the app/signup CTAs", () => {
    const content = source("components/intent/water-temp-page-content.tsx");

    expect(content.indexOf("<WaterTempHeroSection")).toBeLessThan(
      content.indexOf("<BeachFollowPilot"),
    );
    expect(content.indexOf("<BeachFollowPilot")).toBeLessThan(
      content.indexOf("<ContentPageAppHandoffCta"),
    );
    expect(content.indexOf("<BeachFollowPilot")).toBeLessThan(
      content.indexOf("<AlertCaptureCta"),
    );
    expect(content).toContain("defaultTopic={FollowTopic.WaterTemp}");
  });

  it("keeps the fallback city answer before follow and general CTAs", () => {
    const overview = source("components/intent/water-temp-overview-section.tsx");
    const cityRoute = source("app/[intent]/[city]/page.tsx");

    expect(overview.indexOf("<Card")).toBeLessThan(
      overview.indexOf("<BeachFollowPilot"),
    );
    expect(cityRoute).toContain("<WaterTempOverviewSection");
    expect(cityRoute).toContain("beachId={spots[0]?.id}");
  });

  it("keeps beach answer/schema first and follow before the generic CTA switch", () => {
    const subPage = source("lib/utils/beach-sub-page-utils.tsx");

    expect(subPage).toContain("<WaterTempDatasetSchema");
    expect(subPage).toContain("<WaterTempFAQSchema");
    expect(subPage).toContain("<BreadcrumbStructuredData");
    expect(subPage.indexOf("<BeachDetailClient")).toBeLessThan(
      subPage.indexOf("<BeachFollowPilot"),
    );
    expect(subPage.indexOf("<BeachFollowPilot")).toBeLessThan(
      subPage.indexOf("<BeachSubPageCtaSwitch"),
    );
  });

  it("preserves the legacy beach route metadata and delegated answer rendering", () => {
    const route = source("app/beach/[slug]/water-temp/page.tsx");

    expect(route).toContain('pageType: "water-temp"');
    expect(route).toContain("return renderBeachSubPage");
    expect(route).toContain("buildDynamicWaterTempMetadata");
    expect(route).toContain('path: `/beach/${params.slug}/water-temp`');
    expect(route).toContain("robots:");
  });
});
