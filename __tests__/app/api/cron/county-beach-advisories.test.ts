/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";

import { GET } from "@/app/api/cron/county-beach-advisories/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { runCountyAdvisoryIngest } from "@/lib/services/county-beach-advisories";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: jest.fn(() => true),
}));
jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));
jest.mock("@/lib/services/county-beach-advisories", () => ({
  createCountyAdvisoryRepository: jest.fn(),
  createCountyFeedFetcher: jest.fn(),
  runCountyAdvisoryIngest: jest.fn(),
}));

describe("County advisory cron route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({});
    (runCountyAdvisoryIngest as jest.Mock).mockResolvedValue({ status: "ok" });
  });

  it("rejects requests before constructing the County client", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers") as {
      validateCronRequest: jest.Mock;
    };
    validateCronRequest.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/cron/county-beach-advisories"));

    expect(response.status).toBe(401);
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(runCountyAdvisoryIngest).not.toHaveBeenCalled();
  });

  it("is the only route that may construct the County feed client", () => {
    const source = readFileSync("app/api/cron/county-beach-advisories/route.ts", "utf8");
    expect(source).toContain("createCountyFeedFetcher");
    expect(source).toContain("withObservedCron");
  });
});
