/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMockSupabaseClient,
  createMockRequest,
  createMockAdminUser,
  createMockUser,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
} from "@/test-utils/api-test-helpers";

/** Type for the bulk forecasts update API response */
interface ForecastsUpdateResponse {
  total?: number;
  successful?: number;
  failed?: number;
  results?: Array<{
    beachId: string;
    success: boolean;
    forecastsGenerated?: number;
    error?: string;
  }>;
  message?: string;
}

/** Type for single beach forecast update API response */
interface SingleForecastUpdateResponse {
  beach: string;
  forecastsGenerated: number;
  message: string;
}

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  DEFAULT_SECURITY_HEADERS: {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  },
  withAuth: (handler: any) => async (req: any) => {
    // Extract user from mock client
    const { data: userData } = await mockSupabaseClient.auth.getUser();
    if (!userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401 }
      );
    }
    return handler(req, { user: userData.user });
  },
  createSuccessResponse: (data: any) => {
    return new Response(
      JSON.stringify({ success: true, data, timestamp: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  },
}));

jest.mock("@/lib/supabase/server", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock forecast utility functions
const mockUpdateBeachForecast = jest.fn();
const mockUpdateAllBeachForecasts = jest.fn();
jest.mock("@/lib/utils/forecast-server-utils", () => ({
  updateBeachForecast: (...args: any[]) => mockUpdateBeachForecast(...args),
  updateAllBeachForecasts: (...args: any[]) => mockUpdateAllBeachForecasts(...args),
}));

// Mock admin auth
const mockIsAdmin = jest.fn();
jest.mock("@/lib/auth/admin", () => ({
  isAdmin: (...args: any[]) => mockIsAdmin(...args),
}));

// Import after mocks
const { POST, GET } = require("@/app/api/forecasts/update/route");

describe("POST /api/forecasts/update", () => {
  let cleanup: () => void;

  it("uses the shared API wrapper module for security headers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/forecasts/update/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("Authentication & Authorization", () => {
    it("requires admin authentication", async () => {
      // Mock unauthenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      const response = await POST(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Unauthorized");
    });

    it("rejects non-admin users", async () => {
      // Mock authenticated but non-admin user
      const regularUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, regularUser);
      mockIsAdmin.mockReturnValue(false);

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      const response = await POST(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Admin access required");
    });

    it("allows admin users", async () => {
      const adminUser = createMockAdminUser();
      mockAuthenticatedUser(mockSupabaseClient, adminUser);
      mockIsAdmin.mockReturnValue(true);

      mockUpdateAllBeachForecasts.mockResolvedValue({
        results: [],
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Update All Beaches", () => {
    beforeEach(() => {
      const adminUser = createMockAdminUser();
      mockAuthenticatedUser(mockSupabaseClient, adminUser);
      mockIsAdmin.mockReturnValue(true);
    });

    it("updates forecasts for all beaches", async () => {
      const mockResults = {
        results: [
          { beachId: "beach-1", success: true, forecastsGenerated: 240 },
          { beachId: "beach-2", success: true, forecastsGenerated: 240 },
          { beachId: "beach-3", success: true, forecastsGenerated: 240 },
        ],
      };

      mockUpdateAllBeachForecasts.mockResolvedValue(mockResults);

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      const response = await POST(request);

      const result = await expectSuccessResponse<ForecastsUpdateResponse>(response, 200);

      expect(mockUpdateAllBeachForecasts).toHaveBeenCalled();
      expect(result.data.total).toBe(3);
      expect(result.data.successful).toBe(3);
      expect(result.data.failed).toBe(0);
      expect(result.data.results).toHaveLength(3);
    });

    it("handles partial failures gracefully", async () => {
      const mockResults = {
        results: [
          { beachId: "beach-1", success: true, forecastsGenerated: 240 },
          { beachId: "beach-2", success: false, error: "API rate limit" },
          { beachId: "beach-3", success: true, forecastsGenerated: 240 },
          { beachId: "beach-4", success: false, error: "Invalid coordinates" },
        ],
      };

      mockUpdateAllBeachForecasts.mockResolvedValue(mockResults);

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      const response = await POST(request);

      const result = await expectSuccessResponse<ForecastsUpdateResponse>(response, 200);

      expect(result.data.total).toBe(4);
      expect(result.data.successful).toBe(2);
      expect(result.data.failed).toBe(2);
      expect(result.data.results).toHaveLength(4);
    });

    it("handles empty results", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue({
        results: [],
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      const response = await POST(request);

      const result = await expectSuccessResponse<ForecastsUpdateResponse>(response, 200);

      expect(result.data.total).toBe(0);
      expect(result.data.successful).toBe(0);
      expect(result.data.failed).toBe(0);
    });

    it("handles undefined results", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue({
        results: undefined,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      const response = await POST(request);

      const result = await expectSuccessResponse<ForecastsUpdateResponse>(response, 200);

      expect(result.data.total).toBe(0);
      expect(result.data.successful).toBe(0);
      expect(result.data.failed).toBe(0);
    });
  });

  describe("Update Single Beach", () => {
    beforeEach(() => {
      const adminUser = createMockAdminUser();
      mockAuthenticatedUser(mockSupabaseClient, adminUser);
      mockIsAdmin.mockReturnValue(true);
    });

    it("updates forecasts for a specific beach", async () => {
      const beachId = "beach-123";
      const mockResult = {
        beach: "Pipeline",
        forecastsGenerated: 240,
      };

      mockUpdateBeachForecast.mockResolvedValue(mockResult);

      const request = createMockRequest(
        "POST",
        `http://localhost:3000/api/forecasts/update?beachId=${beachId}`
      );
      const response = await POST(request);

      const result = await expectSuccessResponse<SingleForecastUpdateResponse>(response, 200);

      expect(mockUpdateBeachForecast).toHaveBeenCalledWith(beachId);
      expect(result.data.beach).toBe("Pipeline");
      expect(result.data.forecastsGenerated).toBe(240);
      expect(result.data.message).toContain("Enhanced forecasts updated for beach");
    });

    it("handles beach update errors", async () => {
      const beachId = "invalid-beach";

      mockUpdateBeachForecast.mockRejectedValue(new Error("Beach not found"));

      const request = createMockRequest(
        "POST",
        `http://localhost:3000/api/forecasts/update?beachId=${beachId}`
      );

      // Should throw error and be caught by withAuth wrapper
      await expect(POST(request)).rejects.toThrow("Beach not found");
    });

    it("passes correct beach ID from query parameter", async () => {
      const beachId = "specific-beach-456";
      mockUpdateBeachForecast.mockResolvedValue({
        beach: "Test Beach",
        forecastsGenerated: 240,
      });

      const request = createMockRequest(
        "POST",
        `http://localhost:3000/api/forecasts/update?beachId=${beachId}`
      );
      await POST(request);

      expect(mockUpdateBeachForecast).toHaveBeenCalledWith(beachId);
    });
  });

  describe("GET /api/forecasts/update", () => {
    beforeEach(() => {
      const adminUser = createMockAdminUser();
      mockAuthenticatedUser(mockSupabaseClient, adminUser);
      mockIsAdmin.mockReturnValue(true);
    });

    it("returns API documentation for admin users", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/update");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();

      expect(json).toHaveProperty("message");
      expect(json).toHaveProperty("usage");
      expect(json).toHaveProperty("dataSource");
      expect(json).toHaveProperty("timestamp");

      // Verify usage documentation
      expect(json.usage).toHaveProperty("POST /api/forecasts/update");
      expect(json.usage).toHaveProperty("POST /api/forecasts/update?beachId=xyz");
    });

    it("requires admin authentication for GET", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/update");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Unauthorized");
    });

    it("rejects non-admin users for GET", async () => {
      const regularUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, regularUser);
      mockIsAdmin.mockReturnValue(false);

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/update");
      const response = await GET(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Admin access required");
    });
  });

  describe("Logging", () => {
    beforeEach(() => {
      const adminUser = createMockAdminUser({ email: "admin@quiver.com" });
      mockAuthenticatedUser(mockSupabaseClient, adminUser);
      mockIsAdmin.mockReturnValue(true);
    });

    it("logs admin user email on forecast update", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      mockUpdateAllBeachForecasts.mockResolvedValue({
        results: [],
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("admin@quiver.com")
      );

      consoleSpy.mockRestore();
    });

    it("logs beach ID when updating specific beach", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const beachId = "beach-specific-123";

      mockUpdateBeachForecast.mockResolvedValue({
        beach: "Test Beach",
        forecastsGenerated: 240,
      });

      const request = createMockRequest(
        "POST",
        `http://localhost:3000/api/forecasts/update?beachId=${beachId}`
      );
      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(beachId)
      );

      consoleSpy.mockRestore();
    });

    it("logs when updating all beaches", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      mockUpdateAllBeachForecasts.mockResolvedValue({
        results: [],
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("all beaches")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Response Messages", () => {
    beforeEach(() => {
      const adminUser = createMockAdminUser();
      mockAuthenticatedUser(mockSupabaseClient, adminUser);
      mockIsAdmin.mockReturnValue(true);
    });

    it("includes success message for beach update", async () => {
      mockUpdateBeachForecast.mockResolvedValue({
        beach: "Pipeline",
        forecastsGenerated: 240,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/forecasts/update?beachId=beach-1"
      );
      const response = await POST(request);

      const result = await expectSuccessResponse<SingleForecastUpdateResponse>(response, 200);
      expect(result.data.message).toContain("Enhanced forecasts updated for beach");
    });

    it("includes success message for all beaches update", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue({
        results: [],
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/forecasts/update");
      const response = await POST(request);

      const result = await expectSuccessResponse<ForecastsUpdateResponse>(response, 200);
      expect(result.data.message).toContain("Enhanced forecasts updated for all beaches");
    });
  });
});
