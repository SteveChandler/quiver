import { computeBestDaysForUser } from "@/lib/alerts/best-days";
const mockServiceFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const HELD_BEACH_ID = "11111111-1111-4111-8111-111111111111";

async function configureHoldStore(heldRows: unknown[]): Promise<void> {
  (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue({
    from: mockServiceFrom,
  });
  mockServiceFrom.mockImplementation((table: string) => {
      const chain: Record<string, jest.Mock> = {
        select: jest.fn(),
        in: jest.fn(),
      };
      chain.select.mockReturnValue(chain);
      chain.in.mockResolvedValue(
        table === "water_quality_held_beaches"
          ? { data: heldRows, error: null }
          : { data: [], error: null },
      );
      return chain;
    });
}

async function seedHeldBeach(beachId: string): Promise<void> {
  await configureHoldStore([{ beach_id: beachId }]);
}

describe("computeBestDaysForUser", () => {
  beforeEach(async () => {
    await configureHoldStore([]);
  });

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

  it("skips a higher-scoring night slot in favor of a passing daylight slot", async () => {
    const rpc = jest.fn(async (
      _name: string,
      params: { p_wave_height: string },
    ) => ({
      data: params.p_wave_height === "4"
        ? { state: "learned", score: 9.5, label: "EPIC" }
        : { state: "learned", score: 7, label: "GOOD" },
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
                      forecast_at: "2026-08-04T10:00:00.000Z",
                      wave_height: "4",
                      wave_period: "14s",
                      wind_speed: "1",
                      wind_direction_deg: 270,
                      tide_height: "3",
                    },
                    {
                      forecast_at: "2026-08-04T22:00:00.000Z",
                      wave_height: "3",
                      wave_period: "11s",
                      wind_speed: "8",
                      wind_direction_deg: 270,
                      tide_height: "3",
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

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "compute_user_match_score",
      expect.objectContaining({ p_wave_height: "3" }),
    );
    expect(slots).toEqual([
      expect.objectContaining({
        beach_name: "Cardiff Reef",
        score: 7,
        time: "3pm",
      }),
    ]);
  });

  it("keeps the user's configured beach in the digest even when it is held", async () => {
    await seedHeldBeach(HELD_BEACH_ID);
    const rpc = jest.fn(async () => ({
      data: { state: "learned", score: 9.5, label: "EPIC" },
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
                    beach_id: HELD_BEACH_ID,
                    beaches: {
                      id: HELD_BEACH_ID,
                      name: "Held Beach",
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
                      forecast_at: "2026-08-04T17:00:00.000Z",
                      wave_height: "4",
                      wave_period: "14s",
                      wind_speed: "1",
                      wind_direction_deg: 270,
                      tide_height: "3",
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
        beach_name: "Held Beach",
        score: 9.5,
      }),
    ]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
