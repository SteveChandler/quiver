/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";

import { GET } from "@/app/api/cron/week-scout-canary/route";
import { runWeekScoutCanary } from "@/lib/monitoring/week-scout-canary";

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: jest.fn(() => true),
}));
jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));
jest.mock("@/lib/monitoring/week-scout-canary", () => ({
  runWeekScoutCanary: jest.fn(),
}));

const request = () => new Request("http://localhost/api/cron/week-scout-canary");

describe("Week Scout canary cron route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (require("@/lib/middleware/api-wrappers").validateCronRequest as jest.Mock).mockReturnValue(true);
  });

  it("rejects unauthorized requests without running Week Scout", async () => {
    (require("@/lib/middleware/api-wrappers").validateCronRequest as jest.Mock).mockReturnValue(false);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(runWeekScoutCanary).not.toHaveBeenCalled();
  });

  it("returns 200 when Week Scout is healthy", async () => {
    (runWeekScoutCanary as jest.Mock).mockResolvedValue({ healthy: true, rankedWindows: 4 });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ healthy: true, rankedWindows: 4 });
  });

  it("returns 503 naming the reason when Week Scout withholds every pick", async () => {
    (runWeekScoutCanary as jest.Mock).mockResolvedValue({
      healthy: false,
      reason: "hold_state_unavailable",
      detail: "Week Scout withheld every pick: hold_state_unavailable",
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Week Scout canary failed: hold_state_unavailable");
  });

  it("is scheduled every 30 minutes, offset from the County feed", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons).toContainEqual({ path: "/api/cron/week-scout-canary", schedule: "10,40 * * * *" });
    const source = readFileSync("app/api/cron/week-scout-canary/route.ts", "utf8");
    expect(source).toContain('schedule: "10,40 * * * *"');
  });
});
