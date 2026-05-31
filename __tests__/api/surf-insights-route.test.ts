/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

type MockUser = { id: string } | null;
type RouteHandler = (
  request: NextRequest,
  context: { user: MockUser }
) => Promise<Response>;

let mockUser: MockUser = null;

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth:
      (handler: RouteHandler) =>
      async (request: NextRequest): Promise<Response> =>
        handler(request, { user: mockUser }),
    withRateLimit: <T>(handler: T) => handler,
  };
});

jest.mock("@/lib/services/similarity-insights-service", () => ({
  computeSimilarityInsights: jest.fn(),
}));

import { GET } from "@/app/api/surf/insights/route";
import { computeSimilarityInsights } from "@/lib/services/similarity-insights-service";

const mockComputeSimilarityInsights =
  computeSimilarityInsights as jest.MockedFunction<
    typeof computeSimilarityInsights
  >;

const VALID_QUERY =
  "beachId=550e8400-e29b-41d4-a716-446655440000" +
  "&beachName=Ocean%20Beach" +
  "&waveHeight=3.5" +
  "&wavePeriod=12" +
  "&windSpeed=8";

describe("GET /api/surf/insights", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
    mockComputeSimilarityInsights.mockResolvedValue({
      matchPercent: 82,
      label: "Perfect",
      reasonBullets: ["Looks familiar"],
      similarSessions: [],
      boardTip: null,
      sessionCount: 4,
      state: "ready",
    });
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/surf/insights/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+['"]@\/lib\/api-utils['"]/);
    expect(source).toMatch(/from\s+['"]@\/lib\/middleware\/api-wrappers['"]/);
  });

  it("validates required query parameters before computing insights", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/surf/insights?beachName=Ocean%20Beach"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: "Invalid input: expected string, received undefined",
    });
    expect(mockComputeSimilarityInsights).not.toHaveBeenCalled();
  });

  it("returns an anonymous onboarding response with short private cache", async () => {
    const response = await GET(
      new NextRequest(`http://localhost:3000/api/surf/insights?${VALID_QUERY}`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(body).toMatchObject({
      success: true,
      data: {
        status: "onboarding",
        message: "Sign in to see personalized insights based on your sessions.",
      },
    });
    expect(mockComputeSimilarityInsights).not.toHaveBeenCalled();
  });

  it("computes authenticated insights and sets private cache headers", async () => {
    mockUser = { id: "user-1" };

    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/surf/insights?${VALID_QUERY}` +
          "&windDirection=270&tideHeight=2.5&tideStatus=%20Rising%20" +
          "&windowStart=2026-05-26T12%3A00%3A00.000Z"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
    expect(mockComputeSimilarityInsights).toHaveBeenCalledWith("user-1", {
      beachId: "550e8400-e29b-41d4-a716-446655440000",
      beachName: "Ocean Beach",
      waveHeight: 3.5,
      wavePeriod: 12,
      windSpeed: 8,
      windDirection: 270,
      tideHeight: 2.5,
      tideStatus: "Rising",
      windowStart: "2026-05-26T12:00:00.000Z",
    });
    expect(body).toMatchObject({
      success: true,
      data: {
        matchPercent: 82,
        label: "Perfect",
        reasonBullets: ["Looks familiar"],
        state: "ready",
      },
    });
  });
});
