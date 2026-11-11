import {
  ForecastIndexabilityUnavailableError,
  getForecastIndexabilityForBeaches,
} from "@/lib/seo/forecast-indexability";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

function clientReturning(result: { data: unknown[] | null; error: { message: string } | null }) {
  const query = {
    select: () => query,
    in: () => query,
    gte: () => query,
    lt: () => query,
    order: () => query,
    limit: async () => result,
  };
  return { from: jest.fn(() => query) };
}

describe("getForecastIndexabilityForBeaches read failures", () => {
  it("throws a typed error when the coverage query returns an error, instead of an empty Map", async () => {
    jest.mocked(createSupabaseServiceRoleClient).mockResolvedValue(
      clientReturning({ data: null, error: { message: "canceling statement due to statement timeout" } }) as never,
    );

    await expect(getForecastIndexabilityForBeaches(["beach-1"])).rejects.toBeInstanceOf(
      ForecastIndexabilityUnavailableError,
    );
  });

  it("throws a typed error when the client cannot be created", async () => {
    jest.mocked(createSupabaseServiceRoleClient).mockRejectedValue(new Error("missing service role key") as never);

    await expect(getForecastIndexabilityForBeaches(["beach-1"])).rejects.toThrow(/client creation failed/);
  });

  it("returns no snapshot for a beach that has no forecast rows", async () => {
    jest.mocked(createSupabaseServiceRoleClient).mockResolvedValue(
      clientReturning({ data: [], error: null }) as never,
    );

    const result = await getForecastIndexabilityForBeaches(["beach-1"]);

    expect(result.get("beach-1")?.forecastAvailable ?? false).toBe(false);
  });
});
