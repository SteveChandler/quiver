/**
 * @jest-environment node
 */

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

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

import { GET } from "@/app/api/cron/reengagement-email/route";

describe("retired condition-based re-engagement cron", () => {
  beforeEach(() => {
    mockValidateCronRequest.mockReturnValue(true);
  });

  it("rejects unauthorized requests", async () => {
    mockValidateCronRequest.mockReturnValue(false);
    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(401);
  });

  it("cannot expose an unbound legacy forecast recommendation", async () => {
    const response = await GET(new Request("http://localhost"));
    const body = await response.json();

    expect(body).toMatchObject({
      retired: true,
      summary: { candidates: 0, sent: 0, skipped: { retired: 1 } },
    });
  });
});
