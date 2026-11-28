jest.mock("@/lib/tide-stations/hubs", () => ({ loadRegionCounts: jest.fn() }));
jest.mock("@/lib/tide-stations/queries", () => ({ listTideStationSlugsForSitemap: jest.fn() }));
jest.mock("@/lib/tide-stations/kept-station-slugs.json", () => ({
  _source: "test",
  linked: ["la-jolla-ca-9410230"],
  visited: [],
  searched: ["aberdeen-abe-gbr-bodc"],
}));

import { loadRegionCounts } from "@/lib/tide-stations/hubs";
import { listTideStationSlugsForSitemap } from "@/lib/tide-stations/queries";
import { getTideStationSitemapRoutes } from "@/lib/tide-stations/sitemap";

const base = "https://www.quiversurf.app";
const original = process.env.TIDE_STATION_PRUNE;

beforeEach(() => {
  delete process.env.TIDE_STATION_PRUNE;
  (loadRegionCounts as jest.Mock).mockResolvedValue([
    { country_code: "US", country_slug: "usa", region: "CA", region_slug: "ca", station_count: 3 },
    { country_code: "JP", country_slug: "japan", region: null, region_slug: null, station_count: 1 },
  ]);
  (listTideStationSlugsForSitemap as jest.Mock).mockResolvedValue([
    "la-jolla-ca-9410230",
    "antioch-ca-9415064",
    "aberdeen-abe-gbr-bodc",
  ]);
});
afterAll(() => {
  if (original === undefined) delete process.env.TIDE_STATION_PRUNE;
  else process.env.TIDE_STATION_PRUNE = original;
});

describe("tide station sitemap routes", () => {
  it("lists hubs (US regions only) and every open station, not closed ones", async () => {
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

  it("lists every active station when TIDE_STATION_PRUNE is false", async () => {
    process.env.TIDE_STATION_PRUNE = "false";
    const urls = (await getTideStationSitemapRoutes(base)).map((r) => r.url);
    expect(urls).toContain(`${base}/tides/station/antioch-ca-9415064`);
    expect(urls.filter((u) => u.includes("/tides/station/"))).toHaveLength(3);
  });

  it("returns nothing before the registry exists", async () => {
    (loadRegionCounts as jest.Mock).mockResolvedValue(null);
    (listTideStationSlugsForSitemap as jest.Mock).mockResolvedValue([]);
    await expect(getTideStationSitemapRoutes(base)).resolves.toEqual([]);
  });
});
