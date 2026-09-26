/**
 * @jest-environment node
 */

jest.mock("server-only", () => ({}));

const mockValidateCronRequest = jest.fn();
const mockRunSwellEventVerification = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: (...args: unknown[]) => mockValidateCronRequest(...args),
  createErrorResponse: (message: string, details: string, status: number) =>
    Response.json({ message, details }, { status }),
  createSuccessResponse: (data: unknown) => Response.json(data),
  handleApiError: (error: unknown) =>
    Response.json({ error: String(error) }, { status: 500 }),
}));
jest.mock("@/lib/alerts/swell-verification/verify", () => ({
  runSwellEventVerification: (...args: unknown[]) => mockRunSwellEventVerification(...args),
}));
jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: (_path: string, handler: unknown) => handler,
}));

import { GET } from "@/app/api/cron/swell-event-verify/route";

describe("GET /api/cron/swell-event-verify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an invalid cron request", async () => {
    mockValidateCronRequest.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/cron/swell-event-verify"));

    expect(response.status).toBe(401);
    expect(mockRunSwellEventVerification).not.toHaveBeenCalled();
  });

  it("runs verification with the current time", async () => {
    mockValidateCronRequest.mockReturnValue(true);
    mockRunSwellEventVerification.mockResolvedValue({
      pending: 2,
      verified: 2,
      statusCounts: { hit: 1, miss_no_show: 0, miss_timing: 1, miss_size: 0, no_observations: 0 },
      errors: 0,
      durationMs: 10,
    });

    const response = await GET(new Request("http://localhost/api/cron/swell-event-verify"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ verified: 2 }));
    expect(mockRunSwellEventVerification).toHaveBeenCalledWith({ now: expect.any(Date) });
  });

  it("returns a real error status when the run fails", async () => {
    mockValidateCronRequest.mockReturnValue(true);
    mockRunSwellEventVerification.mockRejectedValue(new Error("relation does not exist"));

    const response = await GET(new Request("http://localhost/api/cron/swell-event-verify"));

    expect(response.status).toBe(500);
  });
});
