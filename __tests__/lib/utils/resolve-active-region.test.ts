/**
 * Tests for resolveActiveRegion
 *
 * Covers the 4-step resolution order used by /forecast:
 *   1. Explicit `?region=` URL override
 *   2. Authed user's home-beach region slug
 *   3. IP cookie → closest region via `getClosestRegion`
 *   4. Default `southern-california`
 */

import { resolveActiveRegion } from "@/lib/utils/resolve-active-region";

const mockCookieGet = jest.fn<{ value: string } | undefined, [string]>();

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: (name: string) => mockCookieGet(name),
  })),
}));

describe("resolveActiveRegion", () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
    mockCookieGet.mockReturnValue(undefined);
  });

  it("returns the region named in `?region=` even when auth + cookie are set", async () => {
    mockCookieGet.mockImplementation((name) =>
      name === "quiver_ip_region"
        ? {
            value: JSON.stringify({
              latitude: 21.3,
              longitude: -157.8,
              city: "Honolulu",
            }),
          }
        : undefined
    );

    const region = await resolveActiveRegion({
      searchParams: { region: "florida" },
      authedUserHomeRegionSlug: "san-diego",
    });

    expect(region.slug).toBe("florida");
  });

  it("falls through to auth home region when URL override missing", async () => {
    mockCookieGet.mockImplementation((name) =>
      name === "quiver_ip_region"
        ? {
            value: JSON.stringify({
              latitude: 21.3,
              longitude: -157.8,
              city: "Honolulu",
            }),
          }
        : undefined
    );

    const region = await resolveActiveRegion({
      searchParams: {},
      authedUserHomeRegionSlug: "orange-county",
    });

    expect(region.slug).toBe("orange-county");
  });

  it("ignores unknown `?region=` slugs and falls through to cookie resolution", async () => {
    mockCookieGet.mockImplementation((name) =>
      name === "quiver_ip_region"
        ? {
            value: JSON.stringify({
              latitude: 32.75,
              longitude: -117.25,
              city: "San Diego",
            }),
          }
        : undefined
    );

    const region = await resolveActiveRegion({
      searchParams: { region: "not-a-real-region" },
    });

    // San Diego coords → nearest FORECAST_REGIONS center is `san-diego`
    expect(region.slug).toBe("san-diego");
  });

  it("resolves SD coords in the IP cookie to a coastal CA forecast region", async () => {
    mockCookieGet.mockImplementation((name) =>
      name === "quiver_ip_region"
        ? {
            value: JSON.stringify({
              latitude: 32.75,
              longitude: -117.25,
              city: "San Diego",
            }),
          }
        : undefined
    );

    const region = await resolveActiveRegion({ searchParams: {} });

    expect(region.states).toContain("ca");
    // Specifically the SD region because its centerLat/centerLon are closest
    expect(region.slug).toBe("san-diego");
  });

  it("defaults to southern-california when cookie is missing", async () => {
    // No cookie set
    const region = await resolveActiveRegion({ searchParams: {} });

    expect(region.slug).toBe("southern-california");
  });

  it("defaults to southern-california when cookie JSON is invalid", async () => {
    mockCookieGet.mockImplementation((name) =>
      name === "quiver_ip_region"
        ? { value: "{not-valid-json" }
        : undefined
    );

    const region = await resolveActiveRegion({ searchParams: {} });

    expect(region.slug).toBe("southern-california");
  });

  it("handles URL-encoded cookie values", async () => {
    const payload = JSON.stringify({
      latitude: 21.3,
      longitude: -157.8,
      city: "Honolulu",
    });
    mockCookieGet.mockImplementation((name) =>
      name === "quiver_ip_region"
        ? { value: encodeURIComponent(payload) }
        : undefined
    );

    const region = await resolveActiveRegion({ searchParams: {} });

    expect(region.slug).toBe("hawaii");
  });

  it("treats `?region=` as array (when Next passes it through) and uses first entry", async () => {
    const region = await resolveActiveRegion({
      searchParams: { region: ["hawaii", "florida"] },
    });
    expect(region.slug).toBe("hawaii");
  });

  it("ignores unknown `authedUserHomeRegionSlug` and falls through", async () => {
    const region = await resolveActiveRegion({
      searchParams: {},
      authedUserHomeRegionSlug: "bogus-region",
    });

    // No cookie → default
    expect(region.slug).toBe("southern-california");
  });
});
