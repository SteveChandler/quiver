const mockQuery = {
  from: jest.fn(),
  select: jest.fn(),
  eq: jest.fn(),
  not: jest.fn(),
  or: jest.fn(),
  in: jest.fn(),
  then: (resolve: (value: unknown) => unknown) => resolve({ count: 1, error: null }),
};

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => ({ from: mockQuery.from })),
}));
jest.mock("@/lib/data/monthly-surf-data", () => ({
  getStateSurfProfile: jest.fn(() => ({})),
}));

import { getBestTimeToSurfUrl } from "@/lib/utils/best-time-to-surf-utils";

beforeEach(() => {
  jest.clearAllMocks();
  for (const method of ["from", "select", "eq", "not", "or", "in"] as const) {
    mockQuery[method].mockReturnValue(mockQuery);
  }
});

it("counts only accepted island beaches for the best-time link", async () => {
  const url = await getBestTimeToSurfUrl("waimea-kauai", "Waimea", "HI", ["kauai-beach"]);

  expect(url).toBe("/best-time-to-surf/waimea-kauai");
  expect(mockQuery.in).toHaveBeenCalledTimes(2);
  expect(mockQuery.in).toHaveBeenNthCalledWith(1, "id", ["kauai-beach"]);
  expect(mockQuery.in).toHaveBeenNthCalledWith(2, "id", ["kauai-beach"]);
});

it("keeps non-island city counts unscoped", async () => {
  expect(await getBestTimeToSurfUrl("san-diego", "San Diego", "CA"))
    .toBe("/best-time-to-surf/san-diego");
  expect(mockQuery.in).not.toHaveBeenCalled();
});

it("does not query city-wide counts when the island has no accepted beaches", async () => {
  expect(await getBestTimeToSurfUrl("waimea-kauai", "Waimea", "HI", []))
    .toBeUndefined();
  expect(mockQuery.from).not.toHaveBeenCalled();
});
