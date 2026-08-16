/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/indexnow-submit/route";
import { submitUrlsInBatches } from "@/lib/services/indexnow-service";
import { SITE_URL } from "@/lib/constants/seo";
import {
  collectIndexNowUrlGroups,
  flattenIndexNowUrlGroups,
} from "@/lib/seo/indexnow-url-collectors";

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

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) =>
    handler()
  ),
}));

jest.mock("@/lib/services/indexnow-service", () => ({
  submitUrlsInBatches: jest.fn(),
}));

jest.mock("@/lib/seo/indexnow-url-collectors", () => ({
  collectIndexNowUrlGroups: jest.fn(),
  flattenIndexNowUrlGroups: jest.fn(),
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

  it("collects, flattens, submits, and returns the IndexNow breakdown", async () => {
    process.env.INDEXNOW_KEY = "test-indexnow-key";

    const urlGroups = {
      intentUrls: [`${SITE_URL}/beginner/san-diego`],
      locationUrls: [
        `${SITE_URL}/ca/san-diego`,
        `${SITE_URL}/beaches/mexico/baja-california`,
      ],
      staticSeoUrls: [`${SITE_URL}/features`],
      beachDetailUrls: [
        `${SITE_URL}/ca/san-diego/blacks`,
        `${SITE_URL}/ca/san-diego/blacks/tides`,
      ],
      bestTimeCityUrls: [`${SITE_URL}/best-time-to-surf/san-diego`],
    };
    const flattenedUrls = [
      `${SITE_URL}/beginner/san-diego`,
      `${SITE_URL}/ca/san-diego`,
      `${SITE_URL}/features`,
    ];

    (collectIndexNowUrlGroups as jest.Mock).mockResolvedValue(urlGroups);
    (flattenIndexNowUrlGroups as jest.Mock).mockReturnValue(flattenedUrls);
    (submitUrlsInBatches as jest.Mock).mockResolvedValue({
      totalSubmitted: 3,
      totalPending: 0,
      batches: [{ urls: flattenedUrls, statusCode: 200 }],
      errors: [],
      warnings: [],
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/indexnow-submit"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(collectIndexNowUrlGroups).toHaveBeenCalledTimes(1);
    expect(flattenIndexNowUrlGroups).toHaveBeenCalledWith(urlGroups);
    expect(submitUrlsInBatches).toHaveBeenCalledWith(flattenedUrls);
    expect(data).toEqual({
      success: true,
      data: {
        submitted: 3,
        pending: 0,
        totalUrls: 3,
        statusCodes: [200],
        warnings: [],
        breakdown: {
          intent: 1,
          location: 2,
          staticSeo: 1,
          beachDetail: 2,
          bestTimeCity: 1,
        },
        batches: 1,
        errors: [],
        durationMs: expect.any(Number),
      },
      timestamp: "2026-05-26T00:00:00.000Z",
    });
  });
});
