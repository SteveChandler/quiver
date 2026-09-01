const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

jest.mock("@/lib/seo/forecast-indexability", () => ({
  getForecastIndexabilityForBeaches: jest.fn(async (beaches: Array<{ id: string }>) =>
    new Map(
      beaches.map((beach) => [
        beach.id,
        {
          forecastAvailable: true,
          selectedStateComplete: true,
          forecastFresh: true,
          forecastValidAt: "2026-08-08T18:00:00.000Z",
          sourceDataUpdatedAt: "2026-08-08T16:00:00.000Z",
          primaryDataSource: "NOAA_NWS",
          isStale: false,
        },
      ]),
    ),
  ),
}));

import { SITE_URL } from "@/lib/constants/seo";
import {
  collectIndexNowUrlGroups,
  collectStaticSeoUrls,
  flattenIndexNowUrlGroups,
  type IndexNowUrlGroups,
} from "@/lib/seo/indexnow-url-collectors";
import { getForecastIndexabilityForBeaches } from "@/lib/seo/forecast-indexability";
import { getIndexableSeoFunnelRoutes } from "@/lib/seo/funnel-pages";

type MockQueryChain = {
  select: jest.Mock<MockQueryChain>;
  not: jest.Mock<MockQueryChain>;
  or: jest.Mock<MockQueryChain>;
  range: jest.Mock;
  then: jest.Mock;
};

function createQueryChain(): MockQueryChain {
  const chain = {} as MockQueryChain;
  chain.select = jest.fn((): MockQueryChain => chain);
  chain.not = jest.fn((): MockQueryChain => chain);
  chain.or = jest.fn((): MockQueryChain => chain);
  chain.range = jest.fn();
  chain.then = jest.fn();
  return chain;
}

describe("IndexNow URL collectors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("covers high-value static SEO routes from the Ahrefs crawl", () => {
    const urls = collectStaticSeoUrls();

    expect(urls).toEqual([...new Set(urls)]);
    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/`,
        `${SITE_URL}/features`,
        `${SITE_URL}/about`,
        `${SITE_URL}/beaches/usa`,
        `${SITE_URL}/beaches/mexico`,
        `${SITE_URL}/for-businesses`,
        `${SITE_URL}/for-surf-schools`,
        `${SITE_URL}/forecast-accuracy`,
        `${SITE_URL}/vs/surfline`,
      ]),
    );
  });

  it("includes forecast, cam, guide, and generated SEO funnel families", () => {
    const urls = collectStaticSeoUrls();

    expect(urls.some((url) => url.startsWith(`${SITE_URL}/forecast/`))).toBe(true);
    expect(urls.some((url) => url.startsWith(`${SITE_URL}/cams/`))).toBe(true);
    expect(urls).toContain(`${SITE_URL}/cams/southern-california`);
    // Redirecting cam region URLs must never be submitted to IndexNow.
    expect(urls).not.toContain(`${SITE_URL}/cams/hawaii`);
    expect(urls).not.toContain(`${SITE_URL}/cams/florida`);
    expect(urls.some((url) => url.startsWith(`${SITE_URL}/guides/surfing-`))).toBe(true);

    for (const route of getIndexableSeoFunnelRoutes()) {
      expect(urls).toContain(`${SITE_URL}${route}`);
    }
  });

  it("flattens URL groups without duplicate submissions", () => {
    const groups: IndexNowUrlGroups = {
      intentUrls: [`${SITE_URL}/beginner/san-diego`],
      locationUrls: [`${SITE_URL}/ca/san-diego`],
      staticSeoUrls: [`${SITE_URL}/features`, `${SITE_URL}/features`],
      beachDetailUrls: [`${SITE_URL}/ca/san-diego/blacks`],
      bestTimeCityUrls: [`${SITE_URL}/best-time-to-surf/san-diego`],
    };

    expect(flattenIndexNowUrlGroups(groups)).toEqual([
      `${SITE_URL}/beginner/san-diego`,
      `${SITE_URL}/ca/san-diego`,
      `${SITE_URL}/features`,
      `${SITE_URL}/ca/san-diego/blacks`,
      `${SITE_URL}/best-time-to-surf/san-diego`,
    ]);
  });

  it("collects generated SEO URL families from mocked Supabase rows", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_cities_with_beach_skills") {
        return Promise.resolve({
          data: [
            {
              city: "San Diego",
              state: "CA",
              country: "USA",
              beach_count: 3,
              has_beginner: true,
              has_advanced: true,
              has_least_crowded: true,
              has_editorial_content: true,
            },
          ],
          error: null,
        });
      }

      if (fn === "get_all_beach_locations") {
        return Promise.resolve({
          data: [
            {
              city: "San Diego",
              state: "CA",
              country: "USA",
              beachCount: 3,
            },
            {
              city: "Rosarito",
              state: "Baja California",
              country: "Mexico",
              beachCount: 2,
            },
          ],
          error: null,
        });
      }

      return Promise.resolve({ data: [], error: null });
    });

    const beachDetailChain = createQueryChain();
    beachDetailChain.range.mockResolvedValue({
      data: [
        {
          id: "beach-blacks",
          slug: "blacks",
          city: "San Diego",
          state: "CA",
          country: "USA",
        },
        {
          id: "beach-alfonsos",
          slug: "alfonsos",
          city: "Rosarito",
          state: "Baja California",
          country: "Mexico",
        },
      ],
      error: null,
    });

    const bestTimeChain = createQueryChain();
    bestTimeChain.then.mockImplementation((resolve) =>
      resolve({
        data: [{ city: "San Diego", state: "CA" }],
        error: null,
      }),
    );

    mockFrom.mockImplementation((table: string) => {
      if (table !== "beaches") return createQueryChain();
      const beachesCallIndex = mockFrom.mock.calls.filter(
        ([calledTable]) => calledTable === "beaches",
      ).length;
      return beachesCallIndex === 1 ? beachDetailChain : bestTimeChain;
    });

    const groups = await collectIndexNowUrlGroups();
    const urls = flattenIndexNowUrlGroups(groups);

    expect(groups.locationUrls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/ca/san-diego`,
        `${SITE_URL}/beaches/usa/ca`,
        `${SITE_URL}/mexico/baja-california/rosarito`,
        `${SITE_URL}/beaches/mexico`,
        `${SITE_URL}/beaches/mexico/baja-california`,
      ]),
    );
    expect(groups.beachDetailUrls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/ca/san-diego/blacks`,
        `${SITE_URL}/ca/san-diego/blacks/tides`,
        `${SITE_URL}/ca/san-diego/blacks/water-temp`,
        `${SITE_URL}/mexico/baja-california/rosarito/alfonsos`,
      ]),
    );
    expect(groups.bestTimeCityUrls).toContain(
      `${SITE_URL}/best-time-to-surf/san-diego`,
    );
    expect(groups.intentUrls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/beginner/san-diego`,
        `${SITE_URL}/least-crowded/san-diego`,
        `${SITE_URL}/water-temp/san-diego`,
      ]),
    );
    expect(urls).toContain(`${SITE_URL}/features`);
    expect(urls).toEqual([...new Set(urls)]);
  });

  it("does not submit stale beach URLs to IndexNow", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const beachDetailChain = createQueryChain();
    beachDetailChain.range.mockResolvedValue({
      data: [{
        id: "beach-stale",
        slug: "stale-break",
        city: "San Diego",
        state: "CA",
        country: "USA",
      }],
      error: null,
    });

    const bestTimeChain = createQueryChain();
    bestTimeChain.then.mockImplementation((resolve) =>
      resolve({ data: [], error: null }),
    );

    mockFrom.mockImplementation((table: string) => {
      if (table !== "beaches") return createQueryChain();
      const beachesCallIndex = mockFrom.mock.calls.filter(
        ([calledTable]) => calledTable === "beaches",
      ).length;
      return beachesCallIndex === 1 ? beachDetailChain : bestTimeChain;
    });

    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(
      new Map([
        ["beach-stale", {
          forecastAvailable: true,
          selectedStateComplete: true,
          forecastFresh: false,
          forecastValidAt: "2026-08-08T18:00:00.000Z",
          sourceDataUpdatedAt: "2026-08-07T00:00:00.000Z",
          primaryDataSource: "NOAA_NWS",
          isStale: true,
        }],
      ]),
    );

    const groups = await collectIndexNowUrlGroups();

    expect(groups.beachDetailUrls).not.toContain(
      `${SITE_URL}/ca/san-diego/stale-break`,
    );
  });
});
