/**
 * @jest-environment node
 */

const mockResolveWaterQualityHolds = jest.fn();

jest.mock("@/lib/recommendations/major-event-hold/water-quality", () => ({
  resolveWaterQualityHolds: (...args: unknown[]) => mockResolveWaterQualityHolds(...args),
}));

import { rankBeaches } from "@/lib/recommendations/selection";

const RAINED = "11111111-1111-4111-8111-111111111111";
const DRY = "22222222-2222-4222-8222-222222222222";
const HELD_UNTIL = "2026-10-25T11:00:00.000Z";

describe("rankBeaches with a hold that lifts on its own", () => {
  beforeEach(() => {
    mockResolveWaterQualityHolds.mockResolvedValue({
      state: "resolved",
      heldBeachIds: [RAINED],
      waterQualityStatusByBeachId: { [RAINED]: "advisory" },
      heldUntilByBeachId: { [RAINED]: HELD_UNTIL },
      epoch: "rain",
    });
  });

  const windows = [
    { id: RAINED, start: "2026-10-23T15:00:00.000Z" },
    { id: RAINED, start: "2026-10-25T15:00:00.000Z" },
    { id: DRY, start: "2026-10-23T15:00:00.000Z" },
  ];

  it("keeps windows that start after the runoff clears", async () => {
    const ranked = await rankBeaches(windows, { compare: () => 0, startsAt: ({ start }) => start });
    expect(ranked).toEqual([windows[1], windows[2]]);
  });

  it("accepts a Date start", async () => {
    const ranked = await rankBeaches(windows, { compare: () => 0, startsAt: ({ start }) => new Date(start) });
    expect(ranked).toEqual([windows[1], windows[2]]);
  });

  it("holds the beach for every candidate without a start", async () => {
    const ranked = await rankBeaches(windows, { compare: () => 0 });
    expect(ranked).toEqual([windows[2]]);
  });
});
