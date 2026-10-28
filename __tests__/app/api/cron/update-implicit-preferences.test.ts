/**
 * Unit tests for the implicit preference aggregation cron.
 */

import { GET, POST } from "@/app/api/cron/update-implicit-preferences/route";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const mockRpc = jest.fn();
const mockFrom = jest.fn();

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const tableRows: Record<string, Record<string, string>[]> = {
  profiles: [{ id: USER_A }, { id: USER_B }],
  // USER_C has a stale preference row (opted out) and must still be visited.
  user_implicit_preferences: [{ user_id: USER_B }, { user_id: USER_C }],
};

function tableQuery(table: string) {
  const query: any = {
    select: jest.fn(() => query),
    order: jest.fn(() => query),
    eq: jest.fn(() => query),
    range: jest.fn(() => Promise.resolve({ data: tableRows[table], error: null })),
  };
  return query;
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })
    ),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: false,
        error,
        details,
        timestamp: new Date().toISOString(),
      })
    ),
    status,
  })),
  handleApiError: jest.fn((error, customMessage, includeDetails) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: false,
        error: customMessage || "Internal Server Error",
        details: includeDetails
          ? { originalError: error instanceof Error ? error.message : String(error) }
          : undefined,
        timestamp: new Date().toISOString(),
      })
    ),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) =>
    handler()
  ),
}));

describe("Implicit Preference Update Cron Job API", () => {
  const routeSource = readFileSync(
    "app/api/cron/update-implicit-preferences/route.ts",
    "utf8"
  );

  const mockRequest = (
    headers: Record<string, string> = {},
    url = "http://localhost/api/cron/update-implicit-preferences"
  ) => {
    const nextUrl = new URL(url);
    return {
      url,
      nextUrl,
      headers: {
        get: jest.fn((name: string) => headers[name] || null),
      },
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(true);
    process.env.VERCEL_ENV = "production";
    mockFrom.mockImplementation((table: string) => tableQuery(table));

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "compute_implicit_preferences") {
        return Promise.resolve({ data: 1, error: null });
      }
      if (fn === "cleanup_expired_events") {
        return Promise.resolve({ data: 12, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "Unknown RPC" } });
    });
  });

  afterEach(() => {
    delete process.env.VERCEL_ENV;
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("should reject requests in non-production environments", async () => {
    process.env.VERCEL_ENV = "development";

    const response = await GET(mockRequest());
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe("Forbidden");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("should reject requests without valid cron authentication", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(mockRequest());
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("computes preferences one user at a time and cleans expired events", async () => {
    const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({
      processedUsers: 3,
      failedUsers: 0,
      deletedExpiredEvents: 12,
      targetUserId: null,
    });
    const computeCalls = mockRpc.mock.calls.filter(([fn]) => fn === "compute_implicit_preferences");
    expect(computeCalls.map(([, args]) => args.target_user_id).sort()).toEqual(
      [USER_A, USER_B, USER_C].sort()
    );
    expect(mockRpc).not.toHaveBeenCalledWith("compute_implicit_preferences", {
      target_user_id: null,
    });
    expect(mockRpc).toHaveBeenCalledWith("cleanup_expired_events");
  });

  it("keeps going when some users fail and reports the failures", async () => {
    mockRpc.mockImplementation((fn: string, args?: { target_user_id: string }) => {
      if (fn === "compute_implicit_preferences") {
        return Promise.resolve(
          args?.target_user_id === USER_B
            ? { data: null, error: { message: "canceling statement due to statement timeout" } }
            : { data: 1, error: null }
        );
      }
      return Promise.resolve({ data: 12, error: null });
    });

    const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({ processedUsers: 2, failedUsers: 1 });
    expectConsoleWarnings([/1\/3 users failed/]);
  });

  it("should pass a target user id for manual recompute", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const response = await GET(
      mockRequest(
        { authorization: "Bearer valid-cron-secret" },
        `http://localhost/api/cron/update-implicit-preferences?userId=${userId}`
      )
    );
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.targetUserId).toBe(userId);
    expect(mockFrom).not.toHaveBeenCalledWith("profiles");
    expect(mockFrom).not.toHaveBeenCalledWith("user_implicit_preferences");
    expect(mockRpc).toHaveBeenCalledWith("compute_implicit_preferences", {
      target_user_id: userId,
    });
  });

  it("should reject invalid target user ids", async () => {
    const response = await GET(
      mockRequest(
        { authorization: "Bearer valid-cron-secret" },
        "http://localhost/api/cron/update-implicit-preferences?userId=not-a-uuid"
      )
    );
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe("Invalid userId");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("should report compute RPC failures when every user fails", async () => {
    mockRpc.mockImplementation(() =>
      Promise.resolve({ data: null, error: { message: "RPC failed" } })
    );

    const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe("Implicit preference update cron failed");
    expect(data.details.originalError).toContain("RPC failed");
  });

  it("should support POST manual triggers", async () => {
    const response = await POST(mockRequest({ authorization: "Bearer valid-cron-secret" }));
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("compute_implicit_preferences", {
      target_user_id: USER_A,
    });
  });
});
