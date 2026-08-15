/**
 * @jest-environment node
 */

const mockServiceFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  rankBeaches,
  selectBeach,
  type RankedBeach,
} from "@/lib/recommendations/selection";
import {
  expectConsoleErrors,
  expectConsoleWarnings,
} from "@/__tests__/setup/test-utils";

const HELD_BEACH_ID = "11111111-1111-4111-8111-111111111111";
const SAFE_BEACH_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SAFE_BEACH_ID = "33333333-3333-4333-8333-333333333333";

interface TestBeach {
  id: string;
  score: number;
}

function tableResult(data: unknown, error: unknown = null): unknown {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    in: jest.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockResolvedValue({ data, error });
  return chain;
}

async function configureHoldStore(args: {
  heldRows?: unknown;
  heldError?: unknown;
  qualityRows?: unknown;
  qualityError?: unknown;
  throwOnHeldQuery?: boolean;
}): Promise<void> {
  (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue({
    from: mockServiceFrom,
  });
  mockServiceFrom.mockImplementation((table: string) => {
    if (table === "water_quality_held_beaches") {
      if (args.throwOnHeldQuery) {
        return {
          select: jest.fn(() => ({
            in: jest.fn().mockRejectedValue(new Error("database unavailable")),
          })),
        };
      }
      return tableResult(args.heldRows ?? [], args.heldError);
    }
    return tableResult(args.qualityRows ?? [], args.qualityError);
  });
}

function needsRankedBeach<T extends { id: string }>(
  _beach: RankedBeach<T>,
): void {}

describe("recommendation beach selection", () => {
  beforeEach(async () => {
    await configureHoldStore({
      heldRows: [],
      qualityRows: [],
    });
  });

  it("does not let a raw beach satisfy the ranked brand", () => {
    const rawBeach: TestBeach = { id: SAFE_BEACH_ID, score: 1 };

    // @ts-expect-error Raw beaches must be constructed by rankBeaches/selectBeach.
    needsRankedBeach(rawBeach);
    expect(rawBeach.id).toBe(SAFE_BEACH_ID);
  });

  it("excludes held beaches from ranking and selection", async () => {
    await configureHoldStore({
      heldRows: [{ beach_id: HELD_BEACH_ID }],
      qualityRows: [],
    });
    const candidates: TestBeach[] = [
      { id: HELD_BEACH_ID, score: 10 },
      { id: SAFE_BEACH_ID, score: 5 },
    ];

    const ranked = await rankBeaches(candidates, {
      compare: (left, right) => right.score - left.score,
    });

    expect(ranked).toEqual([{ id: SAFE_BEACH_ID, score: 5 }]);
    await expect(selectBeach(candidates[0])).resolves.toBeNull();
  });

  it("treats a missing hold table as an empty hold set", async () => {
    await configureHoldStore({
      heldError: { code: "42P01", message: "relation does not exist" },
      throwOnHeldQuery: false,
    });
    const ranked = await rankBeaches(
      [
        { id: SAFE_BEACH_ID, score: 2 },
        { id: OTHER_SAFE_BEACH_ID, score: 9 },
      ],
      { compare: (left, right) => right.score - left.score },
    );

    expect(ranked.map(({ id }) => id)).toEqual([
      OTHER_SAFE_BEACH_ID,
      SAFE_BEACH_ID,
    ]);
    expectConsoleWarnings([/\[water-quality-hold:table-missing\]/]);
  });

  it("fails open when an existing hold table query fails", async () => {
    await configureHoldStore({
      heldError: { code: "PGRST500", message: "database unavailable" },
    });
    const candidates: TestBeach[] = [
      { id: SAFE_BEACH_ID, score: 1 },
      { id: OTHER_SAFE_BEACH_ID, score: 9 },
    ];

    await expect(
      rankBeaches(candidates, {
        compare: (left, right) => right.score - left.score,
      }),
    ).resolves.toEqual([
      { id: OTHER_SAFE_BEACH_ID, score: 9 },
      { id: SAFE_BEACH_ID, score: 1 },
    ]);
    await expect(selectBeach(candidates[0])).resolves.toEqual(candidates[0]);
    expectConsoleErrors([/\[water-quality-hold:query-error\]/]);
    expectConsoleWarnings([/resolver_returned_unresolved/]);
  });

  it("logs the probe failure cause at warn so production can see it", async () => {
    await configureHoldStore({ throwOnHeldQuery: true });

    await rankBeaches([{ id: SAFE_BEACH_ID, score: 1 }], { compare: () => 0 });

    expectConsoleErrors([/\[water-quality-hold:resolution-threw\]/]);
    expectConsoleWarnings([
      /Water-quality hold probe failed \(resolver_returned_unresolved\); treating as no holds known/,
    ]);
  });

  it("fails open when hold resolution throws", async () => {
    await configureHoldStore({ throwOnHeldQuery: true });

    await expect(
      rankBeaches([{ id: SAFE_BEACH_ID, score: 1 }], {
        compare: () => 0,
      }),
    ).resolves.toEqual([{ id: SAFE_BEACH_ID, score: 1 }]);
    await expect(
      selectBeach({ id: SAFE_BEACH_ID, score: 1 }),
    ).resolves.toEqual({ id: SAFE_BEACH_ID, score: 1 });
    expectConsoleErrors([/\[water-quality-hold:resolution-threw\]/]);
    expectConsoleWarnings([/resolver_returned_unresolved/]);
  });

  it("still suppresses a resolved closure even though probe failures fail open", async () => {
    await configureHoldStore({
      heldRows: [{ beach_id: HELD_BEACH_ID }],
      qualityRows: [],
    });

    await expect(
      rankBeaches(
        [
          { id: HELD_BEACH_ID, score: 10 },
          { id: SAFE_BEACH_ID, score: 5 },
        ],
        {
          compare: (left, right) => right.score - left.score,
        },
      ),
    ).resolves.toEqual([{ id: SAFE_BEACH_ID, score: 5 }]);
    await expect(
      selectBeach({ id: HELD_BEACH_ID, score: 10 }),
    ).resolves.toBeNull();
  });
});
