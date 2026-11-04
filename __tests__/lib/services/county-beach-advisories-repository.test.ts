/**
 * @jest-environment node
 */

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { createCountyAdvisoryRepository } from "@/lib/services/county-beach-advisories/repository";

function clientReturning(error: unknown) {
  const query = {
    insert: () => query,
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(resolve({ data: null, error })),
  };
  return { from: () => query } as never;
}

describe("county advisory repository errors", () => {
  it("names the Postgrest message and code instead of [object Object]", async () => {
    const repository = createCountyAdvisoryRepository(
      clientReturning({
        message: "canceling statement due to statement timeout",
        code: "57014",
        details: null,
        hint: null,
      }),
    );

    await expect(
      repository.createRun({ id: "run-1" } as never),
    ).rejects.toThrow(
      "county run create failed: canceling statement due to statement timeout (57014)",
    );
  });
});
