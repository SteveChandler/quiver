import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source-contract guard for the legacy `/beach/[slug]/water-temp` route.
 *
 * These assertions previously lived in
 * `__tests__/components/intent/water-temp-follow-placement.test.tsx`, which was deleted along with
 * the beach-follow pilot. That file's last case covered surviving behaviour rather than the removed
 * control, so it is restored here.
 *
 * `beach-legacy-subpages.test.ts` mocks `renderBeachSubPage`, so it proves delegation happens but
 * cannot prove the route wires dynamic metadata, robots, or the canonical path. This ties the route
 * module to those inputs so a future edit cannot drop them while the mocked behavioural test stays
 * green on an indexable page.
 */
describe("legacy beach water-temperature route contract", () => {
  const route = readFileSync(
    join(process.cwd(), "app/beach/[slug]/water-temp/page.tsx"),
    "utf8",
  );

  it("delegates rendering to the shared crawlable sub-page renderer", () => {
    expect(route).toContain('pageType: "water-temp"');
    expect(route).toContain("return renderBeachSubPage");
  });

  it("builds dynamic metadata from the water-temperature helper", () => {
    expect(route).toContain("buildDynamicWaterTempMetadata");
  });

  it("keeps the canonical legacy path and an explicit robots directive", () => {
    expect(route).toContain("path: `/beach/${params.slug}/water-temp`");
    expect(route).toContain("robots:");
  });
});
