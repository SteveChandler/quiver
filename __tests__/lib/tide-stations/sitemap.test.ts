jest.mock("@/lib/tide-stations/hubs", () => ({ loadRegionCounts: jest.fn() }));
jest.mock("@/lib/tide-stations/queries", () => ({ listTideStationSlugsForSitemap: jest.fn() }));

import { loadRegionCounts } from "@/lib/tide-stations/hubs";
import { listTideStationSlugsForSitemap } from "@/lib/tide-stations/queries";
import { getTideStationSitemapRoutes } from "@/lib/tide-stations/sitemap";

const base = "https://www.quiversurf.app";

describe("tide station sitemap routes", () => {
  it("lists hubs (US regions only) and every station", async () => {
    (loadRegionCounts as jest.Mock).mockResolvedValue([
      { country_code: "US", country_slug: "usa", region: "CA", region_slug: "ca", station_count: 2 },
      { country_code: "JP", country_slug: "japan", region: null, region_slug: null, station_count: 1 },
    ]);
    (listTideStationSlugsForSitemap as jest.Mock).mockResolvedValue(["la-jolla-ca-9410230", "aberdeen-abe-gbr-bodc"]);

    const urls = (await getTideStationSitemapRoutes(base)).map((r) => r.url);

    expect(urls).toEqual([
      `${base}/tides`,
      `${base}/tides/usa`,
      `${base}/tides/usa/ca`,
      `${base}/tides/japan`,
      `${base}/tides/station/la-jolla-ca-9410230`,
      `${base}/tides/station/aberdeen-abe-gbr-bodc`,
    ]);
  });

  it("returns nothing before the registry exists", async () => {
    (loadRegionCounts as jest.Mock).mockResolvedValue(null);
    (listTideStationSlugsForSitemap as jest.Mock).mockResolvedValue([]);
    await expect(getTideStationSitemapRoutes(base)).resolves.toEqual([]);
  });
});
