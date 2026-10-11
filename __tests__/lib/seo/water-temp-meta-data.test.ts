/** @jest-environment node */

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";

describe("getWaterTempMetaData", () => {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    lt: jest.fn(),
    not: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn(),
  };
  const from = jest.fn(() => query);

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of [query.select, query.eq, query.gte, query.lt, query.not, query.order, query.limit]) {
      method.mockReturnValue(query);
    }
    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue({ from });
  });

  it("uses today's reading when present", async () => {
    query.single.mockResolvedValue({ data: { water_temp: "65°F" }, error: null });

    expect(await getWaterTempMetaData("beach-with-reading")).toMatchObject({ tempF: 65 });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("does not use yesterday's reading as a live value", async () => {
    query.single.mockResolvedValue({ data: null, error: { message: "No row" } });

    expect(await getWaterTempMetaData("beach-without-reading")).toEqual({
      tempF: null,
      wetsuitRec: null,
    });
    expect(from).toHaveBeenCalledTimes(1);
  });
});
