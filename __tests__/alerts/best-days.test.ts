import { computeBestDaysForUser } from "@/lib/alerts/best-days";

describe("computeBestDaysForUser", () => {
  it("accepts Phase 1 learned match states for digest slots", async () => {
    const rpc = jest.fn(async () => ({
      data: { state: "learned", score: 7.2, label: "GOOD" },
      error: null,
    }));
    const from = jest.fn((table: string) => {
      if (table === "alert_rules") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [
                  {
                    beach_id: "beach-1",
                    beaches: {
                      id: "beach-1",
                      name: "Cardiff Reef",
                      timezone: "America/Los_Angeles",
                    },
                  },
                ],
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: async () => ({
                  data: [
                    {
                      forecast_at: "2026-05-25T15:00:00.000Z",
                      wave_height: "3.5",
                      wave_period: "12s",
                      wind_speed: "5",
                      wind_direction_deg: 270,
                      tide_height: "2.0",
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      };
    });

    const slots = await computeBestDaysForUser(
      { from, rpc } as never,
      "user-1",
    );

    expect(slots).toEqual([
      expect.objectContaining({
        beach_name: "Cardiff Reef",
        score: 7.2,
        label: "GOOD",
      }),
    ]);
  });
});
