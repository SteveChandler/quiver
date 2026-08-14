import { GET } from "@/app/api/cron/refresh-beach-traffic-weights/route";
import { withCronOutcome } from "@/lib/cron/outcome";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { refreshBeachTrafficWeights } from "@/lib/npc/traffic-weights";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) =>
    handler()
  ),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler: unknown) => handler),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data: unknown, status = 200) => ({
    json: async () => ({ success: true, data }),
    status,
  })),
  createErrorResponse: jest.fn(),
  handleApiError: jest.fn(),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({})),
}));

jest.mock("@/lib/npc/traffic-weights", () => ({
  refreshBeachTrafficWeights: jest.fn(),
}));

const mockWithCronOutcome = withCronOutcome as jest.MockedFunction<
  typeof withCronOutcome
>;
const mockValidateCronRequest = validateCronRequest as jest.MockedFunction<
  typeof validateCronRequest
>;
const mockRefreshBeachTrafficWeights = refreshBeachTrafficWeights as jest.MockedFunction<
  typeof refreshBeachTrafficWeights
>;

describe("refresh beach traffic weights cron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateCronRequest.mockReturnValue(true);
    mockRefreshBeachTrafficWeights.mockResolvedValue([
      {
        beachId: "beach-1",
        views30d: 4,
        weight: 2,
        computedAt: "2026-08-14T00:00:00.000Z",
        marketKey: "ca:san-diego",
        allocationTier: "proven",
      },
    ]);
  });

  it("asserts that at least one traffic weight is refreshed", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/refresh-beach-traffic-weights"),
    );

    expect(response.status).toBe(200);
    expect(mockWithCronOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        job: "/api/cron/refresh-beach-traffic-weights",
        unit: "weights_refreshed",
        expectedMin: 1,
      }),
      expect.any(Function),
    );
    expect(await response.json()).toEqual({
      success: true,
      data: {
        beaches: 1,
        computedAt: "2026-08-14T00:00:00.000Z",
      },
    });
  });
});
