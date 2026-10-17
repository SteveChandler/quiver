/** @jest-environment node */

import { getWindCheckerData } from "@/actions/tools/wind-checker-actions";

let beachRow: Record<string, unknown> | null = null;

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({ data: beachRow, error: beachRow ? null : { message: "not found" } }),
          }),
        }),
      }),
    }),
  }),
}));

jest.mock("@/lib/services/open-meteo-wind-service", () => ({
  fetchHourlyWind: jest.fn(async () => []),
}));

function beach(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "beach-1",
    name: "Test Beach",
    slug: "test-beach",
    lat: 32.7,
    lon: -117.2,
    wind_offshore_deg: null,
    wind_offshore_tol_deg: null,
    aspect_deg: null,
    ...overrides,
  };
}

describe("getWindCheckerData orientation", () => {
  it("resolves an aspect-only beach to offshore and the default tolerance", async () => {
    beachRow = beach({ aspect_deg: 270 });

    const result = await getWindCheckerData("test-beach");

    expect(result.data?.beach).toMatchObject({ wind_offshore_deg: 90, wind_offshore_tol_deg: 30 });
    expect(result.data?.hasOrientationData).toBe(true);
  });

  it("keeps a stored offshore bearing and fills a missing tolerance", async () => {
    beachRow = beach({ wind_offshore_deg: 0, aspect_deg: 200 });

    const result = await getWindCheckerData("test-beach");

    expect(result.data?.beach).toMatchObject({ wind_offshore_deg: 0, wind_offshore_tol_deg: 30 });
    expect(result.data?.hasOrientationData).toBe(true);
  });

  it("leaves a beach with no orientation unresolved instead of guessing", async () => {
    beachRow = beach({ wind_offshore_tol_deg: 45 });

    const result = await getWindCheckerData("test-beach");

    expect(result.data?.beach.wind_offshore_deg).toBeNull();
    expect(result.data?.hasOrientationData).toBe(false);
  });
});
