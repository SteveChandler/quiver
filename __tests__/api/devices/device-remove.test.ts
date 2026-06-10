/**
 * Tests for POST /api/devices/remove
 * Native calls this on sign-out to ensure the platform's push tokens are purged.
 */

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { POST } from "@/app/api/devices/remove/route";
import {
  createMockSupabaseClient,
  createMockUser,
  createMockRequest,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabase),
}));
jest.mock("@/lib/supabase/bearer-client", () => ({
  createBearerTokenClient: jest.fn(() => mockSupabase),
}));

let mockSupabase: MockSupabaseClient;

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
});

describe("POST /api/devices/remove — platform-only (native sign-out)", () => {
  it("removes all rows for user_id + platform when no token provided", async () => {
    const mockUser = createMockUser({ id: "user-abc" });
    mockAuthenticatedUser(mockSupabase, mockUser);

    const mockEq2 = jest.fn().mockResolvedValue({ error: null });
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq1 });
    (mockSupabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

    const request = createMockRequest("POST", "http://localhost:3000/api/devices/remove", {
      body: { platform: "ios" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      message: "Device removed successfully",
      platform: "ios",
    });
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("user_devices");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq1).toHaveBeenCalledWith("user_id", "user-abc");
    expect(mockEq2).toHaveBeenCalledWith("platform", "ios");
    expect(mockSupabase.from).not.toHaveBeenCalledWith("profiles");
  });

  it("removes the exact token when device_token is provided", async () => {
    const mockUser = createMockUser({ id: "user-abc" });
    mockAuthenticatedUser(mockSupabase, mockUser);

    const mockEq3 = jest.fn().mockResolvedValue({ error: null });
    const mockEq2 = jest.fn().mockReturnValue({ eq: mockEq3 });
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq1 });
    (mockSupabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

    const request = createMockRequest("POST", "http://localhost:3000/api/devices/remove", {
      body: { platform: "ios", device_token: "ExponentPushToken[abc]" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      message: "Device removed successfully",
      platform: "ios",
    });
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("user_devices");
    expect(mockEq1).toHaveBeenCalledWith("user_id", "user-abc");
    expect(mockEq2).toHaveBeenCalledWith("platform", "ios");
    expect(mockEq3).toHaveBeenCalledWith("device_token", "ExponentPushToken[abc]");
    expect(mockSupabase.from).not.toHaveBeenCalledWith("profiles");
  });
});

describe("POST /api/devices/remove — validation", () => {
  it("returns 400 when platform is missing", async () => {
    const mockUser = createMockUser();
    mockAuthenticatedUser(mockSupabase, mockUser);

    const request = createMockRequest("POST", "http://localhost:3000/api/devices/remove", {
      body: {},
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("platform is required");
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("returns 400 when the request body is empty", async () => {
    const mockUser = createMockUser();
    mockAuthenticatedUser(mockSupabase, mockUser);

    const request = createMockRequest("POST", "http://localhost:3000/api/devices/remove");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("platform is required");
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid platform value", async () => {
    const mockUser = createMockUser();
    mockAuthenticatedUser(mockSupabase, mockUser);

    const request = createMockRequest("POST", "http://localhost:3000/api/devices/remove", {
      body: { platform: "desktop" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid platform");
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("returns 400 when device_token is present but not a string", async () => {
    const mockUser = createMockUser();
    mockAuthenticatedUser(mockSupabase, mockUser);

    const request = createMockRequest("POST", "http://localhost:3000/api/devices/remove", {
      body: { platform: "ios", device_token: 42 },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("device_token must be a string");
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe("POST /api/devices/remove — authentication", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticatedUser(mockSupabase);

    const request = createMockRequest("POST", "http://localhost:3000/api/devices/remove", {
      body: { platform: "ios" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Authentication required");
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
