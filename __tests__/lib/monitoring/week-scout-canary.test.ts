/**
 * @jest-environment node
 */

import {
  WEEK_SCOUT_CANARY_BEACH_IDS,
  runWeekScoutCanary,
} from "@/lib/monitoring/week-scout-canary";

type Generate = NonNullable<Parameters<typeof runWeekScoutCanary>[0]>["generate"];

function response(
  availability: { state: "available" | "none"; reasonCode?: string },
  rankedSpotCounts: number[],
): Awaited<ReturnType<Generate>> {
  return {
    recommendationAvailability: { holdEpoch: "epoch", ...availability },
    days: [
      {
        localDate: "2026-10-02",
        windows: rankedSpotCounts.map((count) => ({ rankedSpots: Array.from({ length: count }, () => ({})) })),
      },
    ],
  } as unknown as Awaited<ReturnType<Generate>>;
}

const NOW = new Date("2026-10-02T03:10:00.000Z");

describe("runWeekScoutCanary", () => {
  it("asks Week Scout for the fixed beaches over the Best horizon in local time", async () => {
    const generate = jest.fn(async () => response({ state: "available" }, [2]));

    await runWeekScoutCanary({ generate, now: () => NOW });

    expect(generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        candidateBeachIds: [...WEEK_SCOUT_CANARY_BEACH_IDS],
        localTimezone: "America/Los_Angeles",
        // 03:10 UTC on Oct 2 is still Oct 1 in Los Angeles.
        startLocalDate: "2026-10-01",
        dayCount: 3,
        requirePerRowFreshness: true,
      }),
    );
  });

  it("is healthy when picks are available and windows are ranked", async () => {
    const result = await runWeekScoutCanary({
      generate: async () => response({ state: "available" }, [3, 0, 1]),
      now: () => NOW,
    });

    expect(result).toEqual({ healthy: true, rankedWindows: 2 });
  });

  // 2026-10-02: a stale County feed withheld every pick for hours and nothing noticed.
  it("is unhealthy when hold state is unavailable", async () => {
    const result = await runWeekScoutCanary({
      generate: async () => response({ state: "none", reasonCode: "hold_state_unavailable" }, [0]),
      now: () => NOW,
    });

    expect(result).toEqual({
      healthy: false,
      reason: "hold_state_unavailable",
      detail: "Week Scout withheld every pick: hold_state_unavailable",
    });
  });

  it("stays healthy through a real hold, which is the system working", async () => {
    const result = await runWeekScoutCanary({
      generate: async () => response({ state: "none", reasonCode: "major_event_hold" }, [0]),
      now: () => NOW,
    });

    expect(result).toEqual({ healthy: true, rankedWindows: 0, heldBy: "major_event_hold" });
  });

  it("is unhealthy when picks are available but no window is ranked", async () => {
    const result = await runWeekScoutCanary({
      generate: async () => response({ state: "available" }, [0, 0]),
      now: () => NOW,
    });

    expect(result).toEqual({
      healthy: false,
      reason: "no_windows",
      detail: "Week Scout ranked no window for 8 beaches over 3 days",
    });
  });

  it("is unhealthy when Week Scout throws", async () => {
    const result = await runWeekScoutCanary({
      generate: async () => {
        throw new Error("forecast read failed");
      },
      now: () => NOW,
    });

    expect(result).toEqual({ healthy: false, reason: "threw", detail: "forecast read failed" });
  });
});
