jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/user/timezone/route";
import {
  createMockRequest,
  createMockSupabaseClient,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
} from "@/test-utils/api-test-helpers";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

const mockServiceRole = {
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceRoleClient: jest.fn(() => mockServiceRole),
}));

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

function withNextUrl<T extends NextRequest>(request: T): T {
  Object.defineProperty(request, "nextUrl", {
    value: new URL(request.url),
  });
  return request;
}

function mockProfileUpdate(
  data: unknown[] = [{ id: "test-user-123" }],
  error: { message: string } | null = null,
) {
  const query = {
    eq: jest.fn(),
    is: jest.fn(),
    select: jest.fn(),
  };
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.select.mockResolvedValue({ data, error });
  mockServiceRole.from.mockReturnValue({ update: jest.fn(() => query) });
  return query;
}

describe("POST /api/user/timezone", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    jest
      .requireMock("@/lib/supabase/server")
      .createSupabaseServerClient.mockReturnValue(mockSupabase);
  });

  it("returns 401 when signed out", async () => {
    mockUnauthenticatedUser(mockSupabase);

    const response = await POST(
      withNextUrl(createMockRequest("POST", "http://localhost:3000/api/user/timezone", {
        body: { timezone: "UTC" },
      })),
    );

    expect(response.status).toBe(401);
  });

  it.each([
    ["invalid JSON", withNextUrl(new NextRequest("http://localhost:3000/api/user/timezone", { method: "POST", body: "{" }))],
    ["unknown zone", withNextUrl(createMockRequest("POST", "http://localhost:3000/api/user/timezone", { body: { timezone: "Mars/Base" } }))],
    ["empty zone", withNextUrl(createMockRequest("POST", "http://localhost:3000/api/user/timezone", { body: { timezone: "   " } }))],
  ])("returns 400 for %s", async (_name, request) => {
    mockAuthenticatedUser(mockSupabase);

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mockServiceRole.from).not.toHaveBeenCalled();
  });

  it("accepts an Intl-valid region alias", async () => {
    mockAuthenticatedUser(mockSupabase);
    mockProfileUpdate();

    const response = await POST(
      withNextUrl(createMockRequest("POST", "http://localhost:3000/api/user/timezone", {
        body: { timezone: "US/Pacific" },
      })),
    );

    expect(response.status).toBe(200);
  });

  it("trims and accepts UTC, updating a null timezone", async () => {
    mockAuthenticatedUser(mockSupabase);
    const query = mockProfileUpdate();

    const response = await POST(
      withNextUrl(createMockRequest("POST", "http://localhost:3000/api/user/timezone", {
        body: { timezone: " UTC " },
      })),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ success: true, data: { updated: true } }),
    );
    expect(query.eq).toHaveBeenCalledWith("id", "test-user-123");
    expect(query.is).toHaveBeenCalledWith("timezone", null);
  });

  it("returns updated false without overwriting an existing timezone", async () => {
    mockAuthenticatedUser(mockSupabase);
    const query = mockProfileUpdate([]);

    const response = await POST(
      withNextUrl(createMockRequest("POST", "http://localhost:3000/api/user/timezone", {
        body: { timezone: "America/Los_Angeles" },
      })),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ success: true, data: { updated: false } }),
    );
    expect(query.is).toHaveBeenCalledWith("timezone", null);
  });

  it("returns a generic 500 on database failure", async () => {
    mockAuthenticatedUser(mockSupabase);
    mockProfileUpdate([], { message: "secret database details" });

    const response = await POST(
      withNextUrl(createMockRequest("POST", "http://localhost:3000/api/user/timezone", {
        body: { timezone: "UTC" },
      })),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Failed to record browser timezone");
    expect(body.error).not.toContain("secret database details");
    expectConsoleErrors([/\[user-timezone\] Failed to record browser timezone/]);
  });
});
