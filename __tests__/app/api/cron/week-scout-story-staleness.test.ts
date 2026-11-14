/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";

import { GET } from "@/app/api/cron/week-scout-story-staleness/route";
import { checkWeekScoutStoryStaleness } from "@/lib/monitoring/week-scout-story-staleness";

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: jest.fn(() => true),
}));
jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));
jest.mock("@/lib/monitoring/week-scout-story-staleness", () => ({
  checkWeekScoutStoryStaleness: jest.fn(),
}));

const request = () => new Request("http://localhost/api/cron/week-scout-story-staleness");

describe("Week Scout story staleness cron route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (require("@/lib/middleware/api-wrappers").validateCronRequest as jest.Mock).mockReturnValue(true);
  });

  it("rejects unauthorized requests without reading editions", async () => {
    (require("@/lib/middleware/api-wrappers").validateCronRequest as jest.Mock).mockReturnValue(false);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(checkWeekScoutStoryStaleness).not.toHaveBeenCalled();
  });

  it("returns 200 with the stale regions when enough regions are fresh", async () => {
    const result = { healthy: true, activeRegions: 31, freshRegions: 27, staleRegions: ["Santa Cruz"] };
    (checkWeekScoutStoryStaleness as jest.Mock).mockResolvedValue(result);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(result);
  });

  it("returns 503 with the count and missing regions in the top-level error", async () => {
    (checkWeekScoutStoryStaleness as jest.Mock).mockResolvedValue({
      healthy: false,
      reason: "too_few_editions",
      detail: "0 of 31 active regions have today's edition; missing: Oahu, San Diego",
      staleRegions: ["Oahu", "San Diego"],
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    // withObservedCron copies only the top-level error into cron_runs and Sentry.
    expect(body.error).toBe(
      "Week Scout story editions stale (too_few_editions): 0 of 31 active regions have today's edition; missing: Oahu, San Diego",
    );
  });

  it("runs daily after 08:00 Pacific in both standard and daylight time", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons).toContainEqual({ path: "/api/cron/week-scout-story-staleness", schedule: "15 16 * * *" });
    const source = readFileSync("app/api/cron/week-scout-story-staleness/route.ts", "utf8");
    expect(source).toContain('schedule: "15 16 * * *"');
  });
});
