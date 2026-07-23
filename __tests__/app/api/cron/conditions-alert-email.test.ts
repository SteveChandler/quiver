/**
 * @jest-environment node
 */

const mockValidateCronRequest = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: (...args: unknown[]) =>
    mockValidateCronRequest(...args),
  createErrorResponse: (
    error: string,
    details: string,
    status: number,
  ) => Response.json({ error, details }, { status }),
  createSuccessResponse: (data: unknown) => Response.json(data),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: (_path: string, handler: (request: Request) => Response) =>
    handler,
}));

import { GET } from "@/app/api/cron/conditions-alert-email/route";

describe("retired conditions-alert email cron", () => {
  beforeEach(() => {
    mockValidateCronRequest.mockReturnValue(true);
  });

  it("rejects unauthorized requests", async () => {
    mockValidateCronRequest.mockReturnValue(false);
    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(401);
  });

  it("cannot emit a legacy recommendation and points to canonical delivery", async () => {
    const response = await GET(new Request("http://localhost"));
    const body = await response.json();

    expect(body).toMatchObject({
      retired: true,
      replacement: "/api/cron/condition-alert-deliver",
      summary: { candidates: 0, sent: 0, skipped: { retired: 1 } },
    });
  });
});
