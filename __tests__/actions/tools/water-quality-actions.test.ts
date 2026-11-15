/** @jest-environment node */

import {
  getBeachWaterQuality,
  getBeachesWithWaterQuality,
} from "@/actions/tools/water-quality-actions";

let qualityRow: Record<string, unknown> = {};
const listStateFilters: unknown[] = [];

jest.mock("next/cache", () => ({ unstable_cache: <T>(fn: T): T => fn }));
jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      or: () => query,
      in: async (_column: string, states: unknown) => {
        listStateFilters.push(states);
        return { data: [], error: null };
      },
      maybeSingle: async () => ({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "El Porto (Manhattan)", slug: "el-porto-manhattan",
          state: "CA", city: "Manhattan Beach", beach_water_quality: qualityRow },
        error: null,
      }),
    };
    return { from: () => query };
  },
  // No County read: the beach is outside the San Diego feed in these cases.
  createSupabaseServiceRoleClient: () => { throw new Error("no County read in this test"); },
}));

function sample(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    status: "closure", latest_enterococcus: 20, latest_fecal_coliform: null,
    exceedance_count_30d: 2, total_samples_30d: 10, updated_at: "2026-11-13T12:30:22Z",
    ...overrides,
  };
}

describe("getBeachWaterQuality", () => {
  it("does not show a weeks-old reading as the latest result", async () => {
    qualityRow = sample({ latest_sample_date: "2026-10-28" });
    const result = await getBeachWaterQuality("el-porto-manhattan");
    expect(result.success && result.data).toMatchObject({
      status: "unknown", latestEnterococcus: null, latestSampleDate: null, exceedanceCount30d: 0, totalSamples30d: 0 });
  });

  it("keeps a current sample and its readings", async () => {
    const today = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    qualityRow = sample({ latest_sample_date: today });
    const result = await getBeachWaterQuality("el-porto-manhattan");
    expect(result.success && result.data).toMatchObject({
      status: "closure", latestEnterococcus: 20, latestSampleDate: today, exceedanceCount30d: 2, totalSamples30d: 10 });
  });
});

describe("getBeachesWithWaterQuality", () => {
  it("lists California beaches only, because Hawaii has no live sample feed", async () => {
    listStateFilters.length = 0;
    const result = await getBeachesWithWaterQuality();
    expect(result.success).toBe(true);
    expect(listStateFilters).toEqual([["CA"]]);
  });
});
