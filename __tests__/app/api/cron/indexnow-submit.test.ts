/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/indexnow-submit/route";
import { submitUrlsInBatches } from "@/lib/services/indexnow-service";

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

jest.mock("@/lib/services/indexnow-service", () => ({
  submitUrlsInBatches: jest.fn(),
}));

describe("IndexNow submit cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/indexnow-submit/route.ts",
    "utf8"
  );
  const originalIndexNowKey = process.env.INDEXNOW_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(true);
    delete process.env.INDEXNOW_KEY;
  });

  afterAll(() => {
    process.env.INDEXNOW_KEY = originalIndexNowKey;
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("rejects unauthorized cron requests before submission", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new NextRequest("http://localhost/api/cron/indexnow-submit")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      success: false,
      error: "Unauthorized",
      details: "Invalid cron authentication",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(submitUrlsInBatches).not.toHaveBeenCalled();
  });

  it("rejects missing IndexNow key before collecting and submitting URLs", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/cron/indexnow-submit")
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: "Missing configuration",
      details: "INDEXNOW_KEY environment variable is not set",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(submitUrlsInBatches).not.toHaveBeenCalled();
  });
});
