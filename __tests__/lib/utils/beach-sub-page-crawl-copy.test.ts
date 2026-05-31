import { buildBeachSubPageCrawlCopy } from "@/lib/utils/beach-sub-page-crawl-copy";

describe("buildBeachSubPageCrawlCopy", () => {
  it("builds a crawlable tide fallback with an h1, useful copy, and internal links", () => {
    const copy = buildBeachSubPageCrawlCopy({
      beach: {
        name: "38th Avenue",
        city: "Santa Cruz",
        state: "CA",
      },
      pageType: "tides",
      beachPath: "/ca/santa-cruz/38th-avenue-santa-cruz-ca",
    });

    expect(copy.heading).toBe("38th Avenue Tide Chart");
    expect(copy.summary).toContain("Santa Cruz, CA");
    expect(copy.summary).toContain("tide");
    expect(copy.links).toEqual([
      expect.objectContaining({
        label: "Open the full 38th Avenue surf report",
        href: "/ca/santa-cruz/38th-avenue-santa-cruz-ca",
      }),
      expect.objectContaining({
        label: "Check water temperature",
        href: "/ca/santa-cruz/38th-avenue-santa-cruz-ca/water-temp",
      }),
      expect.objectContaining({
        label: "Compare nearby surf spots",
        href: "/map",
      }),
    ]);
  });

  it("builds a crawlable water-temp fallback with a companion tide link", () => {
    const copy = buildBeachSubPageCrawlCopy({
      beach: {
        name: "Coronado North Jetty",
        city: "San Diego",
        state: "CA",
      },
      pageType: "water-temp",
      beachPath: "/ca/san-diego/coronado-north-jetty",
    });

    expect(copy.heading).toBe("Coronado North Jetty Water Temperature");
    expect(copy.summary).toContain("water temperature");
    expect(copy.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Watch the tide window",
        href: "/ca/san-diego/coronado-north-jetty/tides",
      }),
    ]));
  });
});
