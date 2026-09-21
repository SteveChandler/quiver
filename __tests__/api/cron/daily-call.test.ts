/**
 * @jest-environment node
 */

jest.mock("server-only", () => ({}));

const mockValidateCronRequest = jest.fn();
const mockRunDailyCallCron = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: (...args: unknown[]) => mockValidateCronRequest(...args),
  createErrorResponse: (message: string, details: string, status: number) =>
    Response.json({ message, details }, { status }),
  createSuccessResponse: (data: unknown) => Response.json(data),
  handleApiError: (error: unknown) =>
    Response.json({ error: String(error) }, { status: 500 }),
}));
jest.mock("@/lib/cron/daily-call-runner", () => ({
  runDailyCallCron: (...args: unknown[]) => mockRunDailyCallCron(...args),
}));
jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: (_path: string, handler: unknown) => handler,
}));

import { GET } from "@/app/api/cron/daily-call/route";

describe("GET /api/cron/daily-call", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an invalid cron request", async () => {
    mockValidateCronRequest.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/cron/daily-call"));

    expect(response.status).toBe(401);
    expect(mockRunDailyCallCron).not.toHaveBeenCalled();
  });

  it("runs the producer with the current time", async () => {
    mockValidateCronRequest.mockReturnValue(true);
    mockRunDailyCallCron.mockResolvedValue({
      evaluated: 1,
      sent: 1,
      silent: 0,
      skippedCounts: {},
      errors: 0,
      durationMs: 10,
    });

    const response = await GET(new Request("http://localhost/api/cron/daily-call"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ sent: 1 }));
    expect(mockRunDailyCallCron).toHaveBeenCalledWith(
      expect.objectContaining({ now: expect.any(Date) }),
    );
  });
});
