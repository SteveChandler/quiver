/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";

import { GET } from "@/app/api/cron/county-beach-advisories/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { runCountyAdvisoryIngest } from "@/lib/services/county-beach-advisories";
import { syncCountyRainAdvisory } from "@/lib/services/water-quality/rain-advisory-events-sync";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

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
jest.mock("@/lib/services/water-quality/rain-advisory-events-sync", () => ({
  syncCountyRainAdvisory: jest.fn(),
}));

describe("County advisory cron route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (require("@/lib/middleware/api-wrappers").validateCronRequest as jest.Mock).mockReturnValue(true);
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({});
    (runCountyAdvisoryIngest as jest.Mock).mockResolvedValue({ status: "ok", runId: "run-1",
      fetchedAt: "2026-10-18T12:00:00Z", summary: { records: [], countsByType: { advisory: 0 } } });
    (syncCountyRainAdvisory as jest.Mock).mockResolvedValue({ status: "ok", opened: [], extended: [], ended: [] });
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

  // 2026-10-02: an open circuit was logged as `ok` on every tick for hours
  // while recommendation holds went stale and every pick was withheld.
  it("reports an open circuit as unavailable rather than a healthy skip", async () => {
    (runCountyAdvisoryIngest as jest.Mock).mockResolvedValue({
      status: "skipped",
      reason: "circuit_open",
      nextAttemptAt: null,
    });

    const response = await GET(new Request("http://localhost/api/cron/county-beach-advisories"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/circuit is open/i);
    expect(syncCountyRainAdvisory).not.toHaveBeenCalled();
  });

  it("keeps a poll-interval skip healthy", async () => {
    (runCountyAdvisoryIngest as jest.Mock).mockResolvedValue({
      status: "skipped",
      reason: "poll_interval",
      nextAttemptAt: "2026-10-02T04:00:00.000Z",
    });

    const response = await GET(new Request("http://localhost/api/cron/county-beach-advisories"));

    expect(response.status).toBe(200);
    expect(syncCountyRainAdvisory).not.toHaveBeenCalled();
  });

  it("keeps a completed ingest successful when the events table is missing", async () => {
    (syncCountyRainAdvisory as jest.Mock).mockResolvedValue({ status: "table_missing" });
    const response = await GET(new Request("http://localhost/api/cron/county-beach-advisories"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.rainAdvisory).toEqual({ status: "table_missing" });
    expect(syncCountyRainAdvisory).toHaveBeenCalledWith(expect.anything(), {
      id: "run-1", fetched_at: "2026-10-18T12:00:00Z", advisory_count: 0,
    }, expect.any(Date));
    expectConsoleWarnings([/rain advisory events table missing/]);
  });

  it("does not sync on an error run", async () => {
    (runCountyAdvisoryIngest as jest.Mock).mockResolvedValue({ status: "error", errorKind: "transient", error: "down" });
    expect((await GET(new Request("http://localhost/api/cron/county-beach-advisories"))).status).toBe(503);
    expect(syncCountyRainAdvisory).not.toHaveBeenCalled();
  });

  it("does not count an open circuit as a legitimate zero", async () => {
    const { withCronOutcome } = require("@/lib/cron/outcome") as { withCronOutcome: jest.Mock };
    await GET(new Request("http://localhost/api/cron/county-beach-advisories"));
    const { legitimatelyZero } = withCronOutcome.mock.calls[0][0] as {
      legitimatelyZero: (value: unknown) => { reason: string } | undefined;
    };

    expect(legitimatelyZero({ status: "skipped", reason: "circuit_open", nextAttemptAt: null })).toBeUndefined();
    expect(legitimatelyZero({ status: "skipped", reason: "poll_interval", nextAttemptAt: null })).toEqual({
      reason: "County feed skipped: poll_interval",
    });
  });

  it("is the only route that may construct the County feed client", () => {
    const source = readFileSync("app/api/cron/county-beach-advisories/route.ts", "utf8");
    expect(source).toContain("createCountyFeedFetcher");
    expect(source).toContain("withObservedCron");
  });
});
