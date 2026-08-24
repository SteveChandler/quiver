/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

const mockGetCachedNearbyBeachesFromDb = jest.fn();
const mockBulkForecastHandler = jest.fn();

jest.mock("@/lib/services/nearby-beach-service", () => ({
  getCachedNearbyBeachesFromDb: (...args: unknown[]) =>
    mockGetCachedNearbyBeachesFromDb(...args),
  normalizeNearbyBeachQuery: () => ({ radiusMiles: 30, limit: 20 }),
}));

jest.mock("@/app/api/forecasts/bulk/route", () => ({
  bulkForecastHandler: (...args: unknown[]) => mockBulkForecastHandler(...args),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: (data: unknown) =>
    Response.json({ success: true, data }),
  createValidationError: (message: string) =>
    Response.json({ success: false, error: message }, { status: 400 }),
  handleApiError: (error: unknown) =>
    Response.json({ success: false, error: String(error) }, { status: 500 }),
  withAuth: (handler: unknown) => handler,
  withNoStore: (handler: unknown) => handler,
  withRateLimit: (handler: unknown) => handler,
}));

import { GET } from "@/app/api/map/bootstrap/route";

describe("GET /api/map/bootstrap", () => {
  it("preserves the additive water-quality hold field on nearby beaches", async () => {
    mockGetCachedNearbyBeachesFromDb.mockResolvedValue({
      success: true,
      data: [
        {
          id: "la-jolla-shores",
          name: "La Jolla Shores",
          lat: 32.857,
          lon: -117.257,
          waterQualityHold: true,
          waterQualityStatus: "closure",
        },
      ],
    });
    mockBulkForecastHandler.mockResolvedValue(
      Response.json({ success: true, data: {} }),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/map/bootstrap?lat=32.85&lon=-117.25"),
      {} as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.beaches).toEqual([
      expect.objectContaining({
        id: "la-jolla-shores",
        waterQualityHold: true,
        waterQualityStatus: "closure",
      }),
    ]);
  });
});
