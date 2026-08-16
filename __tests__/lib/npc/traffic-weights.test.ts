import {
  computeTrafficWeights,
  fetchBeachTrafficWeights,
} from "@/lib/npc/traffic-weights";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

describe("system-card traffic weights", () => {
  it("models proven, adjacent, and exploration beaches from analytics events", () => {
    const weights = computeTrafficWeights(
      [
        { id: "a", slug: "a", city: "San Diego", state: "CA" },
        { id: "b", slug: "b", city: "San Diego", state: "CA" },
        { id: "c", slug: "Santa Cruz", city: "Santa Cruz", state: "CA" },
      ],
      [
        { eventType: "beach_view", beachId: "a", metadata: null },
        { eventType: "page_view", beachId: "a", metadata: null },
      ],
      "2026-08-13T00:00:00.000Z",
    );

    expect(weights.map(({ allocationTier }) => allocationTier)).toEqual([
      "proven",
      "adjacent",
      "exploration",
    ]);
    expect(weights[0].views30d).toBe(2);
  });

  it("returns null when the materialized table is missing or empty so callers keep posting", async () => {
    const missing = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          in: jest.fn().mockResolvedValue({
            data: null,
            error: { code: "42P01", message: "relation does not exist" },
          }),
        })),
      })),
    };
    const empty = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    };

    await expect(fetchBeachTrafficWeights(missing, ["beach-1"])).resolves.toBeNull();
    await expect(fetchBeachTrafficWeights(empty, ["beach-1"])).resolves.toBeNull();
    expectConsoleWarnings([/npc-traffic/]);
  });
});
