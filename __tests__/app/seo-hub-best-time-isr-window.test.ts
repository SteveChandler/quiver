/**
 * @jest-environment node
 */

// Next.js lowers an ISR page's revalidate to the shortest `unstable_cache`
// revalidate read during the render, so a declared window is only real if no
// read under the page is shorter. Record every window each render reads.
const mockCacheWindowsRead: number[] = [];

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn(
    (
      fn: (...args: unknown[]) => Promise<unknown>,
      _keyParts?: string[],
      options?: { revalidate?: number | false },
    ) =>
      async (...args: unknown[]) => {
        if (typeof options?.revalidate === "number") {
          mockCacheWindowsRead.push(options.revalidate);
        }
        return fn(...args);
      },
  ),
}));

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(),
  createSupabaseServerClient: jest.fn(),
}));

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: jest.fn(async (beaches: unknown[]) => beaches),
}));

jest.mock("@/actions/city/city-metadata-actions", () => ({
  findCityBySlug: jest.fn(),
  getCityExcludeIntents: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/actions/city/best-time-actions", () => ({
  getBestTimeToSurfData: jest.fn(),
}));

jest.mock("@/actions/city/city-editorial-actions", () => ({
  getCityEditorialContent: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/actions/forecast/intent-forecast-actions", () => ({
  getIntentForecastSummary: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/actions/beach/beach-location-list-actions", () => ({
  getLocationPageData: jest.fn(),
}));

jest.mock("@/actions/beach/beach-location-actions", () => ({
  getTopCitiesInState: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/data/server/city-editorial-photo", () => ({
  getCityEditorialPhoto: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/utils/best-time-to-surf-utils", () => ({
  getBestTimeToSurfUrl: jest.fn().mockResolvedValue(undefined),
}));

import BestTimeToSurfPage, {
  revalidate as bestTimeRevalidate,
} from "@/app/best-time-to-surf/[city]/page";
import LocationPage, {
  revalidate as hubRevalidate,
} from "@/app/beaches/[country]/[state]/[city]/page";
import { createPublicReadClient } from "@/lib/supabase/server";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";
import { getBestTimeToSurfData } from "@/actions/city/best-time-actions";
import { getLocationPageData } from "@/actions/beach/beach-location-list-actions";

const fromTables: string[] = [];

function mockPublicReads(): void {
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select", "or", "eq", "ilike", "gte", "lt", "order", "limit", "in", "is", "not",
  ]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: [], error: null });
  (createPublicReadClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      fromTables.push(table);
      return builder;
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCacheWindowsRead.length = 0;
  fromTables.length = 0;
  mockPublicReads();
});

describe("/beaches/[country]/[state]/[city] effective ISR window", () => {
  it("regenerates daily, with no shorter cache read under the surf report", async () => {
    (getLocationPageData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        location: { city: "Test Harbor", state: "CA" },
        stats: { totalBeaches: 0 },
        beaches: [],
      },
    });

    await LocationPage({
      params: Promise.resolve({ country: "usa", state: "ca", city: "test-harbor" }),
    });

    // The surf report really ran its query; it just isn't cached under the page.
    expect(fromTables.length).toBeGreaterThan(0);
    expect(hubRevalidate).toBe(86400);
    expect(Math.min(hubRevalidate, ...mockCacheWindowsRead)).toBe(86400);
  });
});

describe("/best-time-to-surf/[city] effective ISR window", () => {
  it("regenerates hourly, including the live beach list it reads", async () => {
    (findCityBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: { cityName: "Test Harbor", state: "CA", stateName: "California" },
    });
    (getBestTimeToSurfData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        totalBeaches: 0,
        topBeaches: [],
        monthly: Array.from({ length: 12 }, (_, month) => ({
          monthName: new Date(2026, month, 1).toLocaleString("en-US", { month: "long" }),
          score: 50,
          bestMonthCount: 0,
        })),
        peakMonthName: "October",
        waterTempRange: "60-68",
      },
    });

    await BestTimeToSurfPage({ params: Promise.resolve({ city: "test-harbor" }) });

    expect(mockCacheWindowsRead).toContain(3600);
    expect(bestTimeRevalidate).toBe(3600);
    expect(Math.min(bestTimeRevalidate, ...mockCacheWindowsRead)).toBe(3600);
  });
});
