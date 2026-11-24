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

  it("reads at most four coverage batches at one time and still reads every beach", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const requested: string[] = [];
    const query = (): Record<string, unknown> => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        in: (_column: string, ids: string[]) => {
          requested.push(...ids);
          return builder;
        },
        gte: () => builder,
        lt: () => builder,
        order: () => builder,
        limit: async () => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 1));
          inFlight -= 1;
          return { data: [], error: null };
        },
      };
      return builder;
    };
    jest.mocked(createSupabaseServiceRoleClient).mockResolvedValue({ from: jest.fn(query) } as never);
    const ids = Array.from({ length: 575 }, (_, index) => `beach-${index}`);

    const result = await getForecastIndexabilityForBeaches(ids);

    expect(maxInFlight).toBe(4);
    expect(new Set(requested).size).toBe(575);
    expect(result.size).toBe(575);
  });

  it("starts no more batches after one batch fails", async () => {
    const client = clientReturning({ data: null, error: { message: "statement timeout" } });
    jest.mocked(createSupabaseServiceRoleClient).mockResolvedValue(client as never);
    const ids = Array.from({ length: 575 }, (_, index) => `beach-${index}`);

    await expect(getForecastIndexabilityForBeaches(ids)).rejects.toThrow(/coverage query failed/);
    expect(client.from.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("returns no snapshot for a beach that has no forecast rows", async () => {
    jest.mocked(createSupabaseServiceRoleClient).mockResolvedValue(
      clientReturning({ data: [], error: null }) as never,
    );

    const result = await getForecastIndexabilityForBeaches(["beach-1"]);

    expect(result.get("beach-1")?.forecastAvailable ?? false).toBe(false);
  });
});
