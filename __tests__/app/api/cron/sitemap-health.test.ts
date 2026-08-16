/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/sitemap-health/route";
import * as Sentry from "@sentry/nextjs";
import {
  completeCronCheckIn,
  startCronCheckIn,
} from "@/lib/monitoring/sentry-cron";

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: async () => ({
      success: true,
      data,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: async () => ({
      success: false,
      error,
      details,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  handleApiError: jest.fn((error) => ({
    json: async () => ({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));

jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
}));

jest.mock("@/lib/monitoring/sentry-cron", () => ({
  startCronCheckIn: jest.fn(() => "check-in-id"),
  completeCronCheckIn: jest.fn(),
}));

describe("sitemap health cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/sitemap-health/route.ts",
    "utf8"
  );

  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(true);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("rejects unauthorized cron requests", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new NextRequest("http://localhost/api/cron/sitemap-health")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      success: false,
      error: "Unauthorized",
      details: "Invalid cron authentication",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(startCronCheckIn).not.toHaveBeenCalled();
  });

  it("returns a successful empty-sitemap summary when sitemap fetch fails", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
    } as Response);

    const response = await GET(
      new NextRequest("http://localhost/api/cron/sitemap-health")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({
      probed: 0,
      ok: 0,
      failures: [],
      sitemapEmpty: true,
    });
    expect(typeof data.data.durationMs).toBe("number");
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "[sitemap-health] sitemap returned 0 URLs",
      {
        level: "error",
        tags: { cron: "sitemap-health" },
      }
    );
    expect(completeCronCheckIn).toHaveBeenCalledWith(
      "check-in-id",
      "sitemap-health",
      "error",
      expect.any(Number),
    );
  });
});
