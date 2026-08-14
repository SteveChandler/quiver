/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/notifications-deliver/route";
import { withObservedCron } from "@/lib/cron/observability";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { processPendingEvents } from "@/lib/notifications/worker";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));

jest.mock("@/lib/notifications/worker", () => ({
  processPendingEvents: jest.fn(),
}));

describe("notifications deliver cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/notifications-deliver/route.ts",
    "utf8"
  );

  const supabase = { from: jest.fn() };
  const deliverySummary = {
    fetched: 2,
    delivered: 1,
    failed: 1,
  };

  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (processPendingEvents as jest.Mock).mockResolvedValue(deliverySummary);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("uses the API wrapper barrel for cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
    expect(routeSource).toContain('withObservedCron("/api/cron/notifications-deliver"');
    expect(routeSource).toContain('slug: "notifications-deliver"');
  });

  it("rejects unauthorized cron requests before creating a Supabase client", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/notifications-deliver")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Unauthorized" });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(withObservedCron).not.toHaveBeenCalled();
    expect(processPendingEvents).not.toHaveBeenCalled();
  });

  it("runs the notification worker and returns its summary", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/notifications-deliver")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(createSupabaseServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(processPendingEvents).toHaveBeenCalledWith(supabase);
    expect(data).toEqual(deliverySummary);
  });
});
