/** @jest-environment node */

const mockServiceFrom = jest.fn();

jest.mock("@/config/regions", () => ({
  REGIONS: {
    "north-san-diego": { beachSlugs: ["held-beach"] },
  },
  HOME_BEACH_COUNT: 1,
  SOCAL_REGIONS: [],
  NORCAL_REGIONS: [],
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve({ from: mockServiceFrom }),
  ),
}));

import { getBeachesForNPC, type NPCProfile } from "@/lib/npc/npc-selection";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const HELD_BEACH_ID = "11111111-1111-4111-8111-111111111111";

function queryResult(
  data: unknown[],
  resolveData: (values: string[]) => unknown[] = () => data,
): Record<string, jest.Mock> {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    in: jest.fn(),
    not: jest.fn(),
    limit: jest.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockImplementation((_column: string, values: string[]) =>
    Promise.resolve({ data: resolveData(values), error: null }),
  );
  chain.not.mockReturnValue(chain);
  chain.limit.mockResolvedValue({ data, error: null });
  return chain;
}

const npc: NPCProfile = {
  id: "npc-1",
  full_name: "Local Logger",
  personality_type: "local",
  home_region: "north-san-diego",
  activity_level: "medium",
  posting_window: null,
  is_system_account: false,
};

describe("NPC beach selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServiceFrom.mockImplementation((table: string) =>
      table === "water_quality_held_beaches"
        ? queryResult([{ beach_id: HELD_BEACH_ID }], (values) =>
          values.includes(HELD_BEACH_ID) ? [{ beach_id: HELD_BEACH_ID }] : []
        )
        : table === "beach_water_quality"
          ? queryResult([])
        : table === "beaches"
          ? queryResult([
            {
              id: HELD_BEACH_ID,
              name: "Held Beach",
              slug: "held-beach",
              lat: 32,
              lon: -117,
              city: "San Diego",
            },
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Safe Beach",
              slug: "safe-beach",
              lat: 32.1,
              lon: -117.1,
              city: "San Diego",
            },
          ])
          : queryResult([]),
    );
    jest.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not return a held weighted home beach", async () => {
    const supabase = { from: mockServiceFrom } as never;
    const result = await getBeachesForNPC(supabase, {
      ...npc,
      home_region: "north-san-diego",
    });

    expect(result).toBeNull();
  });

  it("re-samples the fallback pool after a held candidate is rejected", async () => {
    const supabase = { from: mockServiceFrom } as never;
    const result = await getBeachesForNPC(supabase, {
      ...npc,
      home_region: "unconfigured-region",
    });

    expectConsoleWarnings([/No region slug config/]);
    expect(result?.id).toBe("22222222-2222-4222-8222-222222222222");
  });
});
