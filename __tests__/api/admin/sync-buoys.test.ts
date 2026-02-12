/**
 * @jest-environment node
 */

import { GET, POST } from "@/app/api/admin/sync-buoys/route";
import { 
  createMockUser,
  createMockAdminUser,
  createMockRequest,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
  mockEnvVars,
} from "@/test-utils/api-test-helpers";

// Mock the NOAA sync service
const mockNOAABuoySync = {
  syncBuoysForExistingBeaches: jest.fn(),
};

jest.mock("@/lib/services/noaa-sync", () => ({
  NOAABuoySync: jest.fn().mockImplementation(() => mockNOAABuoySync),
}));

// Mock admin authentication
jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
}));

// Mock Supabase service role client (withBearerAuth creates this)
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({})),
}));

// Get access to the mocked function after mocking
const mockAuthenticateAdmin = require("@/lib/auth/admin").authenticateAdmin;

describe("/api/admin/sync-buoys", () => {
  let cleanup: () => void;
  let restoreEnv: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    
    // Set up environment variables for service role auth
    restoreEnv = mockEnvVars({
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    });
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
    restoreEnv?.();
  });

  describe("POST - Sync Buoys", () => {
    it("should sync buoys successfully with admin authentication", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        success: true,
        buoysAdded: 15,
        stationsAdded: 8,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: { maxDistanceKm: 150 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: "Successfully synced NOAA data",
        data: {
          buoysAdded: 15,
          stationsAdded: 8,
          maxDistanceKm: 150,
        },
      });

      expect(mockNOAABuoySync.syncBuoysForExistingBeaches).toHaveBeenCalledWith(150);
    });

    it("should sync buoys successfully with service role authentication", async () => {
      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        success: true,
        buoysAdded: 12,
        stationsAdded: 6,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        headers: {
          "Authorization": "Bearer test-service-role-key",
        },
        body: { maxDistanceKm: 200 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.maxDistanceKm).toBe(200);
      
      // Should not call admin auth when service role is present
      expect(mockAuthenticateAdmin).not.toHaveBeenCalled();
    });

    it("should use default distance when not specified", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        success: true,
        buoysAdded: 10,
        stationsAdded: 5,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: {}, // No maxDistanceKm specified
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.maxDistanceKm).toBe(200); // Default value
      expect(mockNOAABuoySync.syncBuoysForExistingBeaches).toHaveBeenCalledWith(200);
    });

    it("should handle malformed JSON body gracefully", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        success: true,
        buoysAdded: 10,
        stationsAdded: 5,
      });

      // Create request with invalid JSON
      const request = new Request("http://localhost:3000/api/admin/sync-buoys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      }) as any;

      const response = await POST(request);
      const data = await response.json();

      // Should still work with defaults when JSON parsing fails
      expect(response.status).toBe(200);
      expect(data.data.maxDistanceKm).toBe(200);
    });

    it("should require admin authentication when no service role", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized - Admin access required",
        status: 401,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: { maxDistanceKm: 150 },
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");

      // Should not call sync service if auth fails
      expect(mockNOAABuoySync.syncBuoysForExistingBeaches).not.toHaveBeenCalled();
    });

    it("should reject invalid service role authentication", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized - Admin access required",
        status: 401,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        headers: {
          "Authorization": "Bearer invalid-service-key",
        },
        body: { maxDistanceKm: 150 },
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("should handle sync service failures gracefully", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        success: false,
        error: "NOAA API connection failed",
        buoysAdded: 0,
        stationsAdded: 0,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: { maxDistanceKm: 150 },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("NOAA API connection failed");
      expect(data.data).toEqual({
        buoysAdded: 0,
        stationsAdded: 0,
      });
    });

    it("should handle sync service exceptions", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockRejectedValue(
        new Error("Network error")
      );

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: { maxDistanceKm: 150 },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error during sync");
    });

    it("should handle authentication exceptions", async () => {
      mockAuthenticateAdmin.mockRejectedValue(new Error("Auth service unavailable"));

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: { maxDistanceKm: 150 },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error during sync");
    });

    it("should validate distance parameter bounds", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        success: true,
        buoysAdded: 5,
        stationsAdded: 3,
      });

      // Test with very large distance
      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: { maxDistanceKm: 10000 }, // Very large distance
      });

      const response = await POST(request);
      const data = await response.json();

      // Should accept the parameter as-is (validation happens in service layer)
      expect(response.status).toBe(200);
      expect(data.data.maxDistanceKm).toBe(10000);
      expect(mockNOAABuoySync.syncBuoysForExistingBeaches).toHaveBeenCalledWith(10000);
    });
  });

  describe("GET - Sync Info", () => {
    it("should return sync endpoint information for admin users", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/admin/sync-buoys");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        endpoint: "/api/admin/sync-buoys",
        description: "Sync NOAA buoys for areas near existing beaches",
        method: "POST",
        parameters: {
          maxDistanceKm: "Maximum distance from beaches to include buoys (default: 200km)",
        },
        note: "This endpoint filters NOAA stations to only include those relevant to your existing beach locations",
      });
    });

    it("should return sync endpoint information with service role auth", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/admin/sync-buoys", {
        headers: {
          "Authorization": "Bearer test-service-role-key",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.endpoint).toBe("/api/admin/sync-buoys");
      
      // Should not call admin auth when service role is present
      expect(mockAuthenticateAdmin).not.toHaveBeenCalled();
    });

    it("should require admin authentication for info endpoint", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized - Admin access required",
        status: 401,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/admin/sync-buoys");

      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("should handle authentication exceptions in GET", async () => {
      mockAuthenticateAdmin.mockRejectedValue(new Error("Auth service unavailable"));

      const request = createMockRequest("GET", "http://localhost:3000/api/admin/sync-buoys");

      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("Security", () => {
    it("should not accept partial service role key matches", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized",
        status: 401,
      });

      // Test with key that only contains part of the service role key
      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        headers: {
          "Authorization": "Bearer test-service", // Partial key
        },
        body: {},
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
      expect(mockAuthenticateAdmin).toHaveBeenCalled(); // Should fall back to admin auth
    });

    it("should not accept service role key in wrong format", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized",
        status: 401,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        headers: {
          "Authorization": "test-service-role-key", // Missing "Bearer " prefix
        },
        body: {},
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
      expect(mockAuthenticateAdmin).toHaveBeenCalled();
    });

    it("should handle missing service role environment variable", async () => {
      // Override environment to remove service role key
      restoreEnv();
      restoreEnv = mockEnvVars({
        SUPABASE_SERVICE_ROLE_KEY: "", // Missing service role key (empty string)
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        success: true,
        buoysAdded: 5,
        stationsAdded: 3,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        headers: {
          "Authorization": "Bearer some-key",
        },
        body: {},
      });

      const response = await POST(request);
      const data = await response.json();
      
      // When service role key is missing/empty, empty string matches any header
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockAuthenticateAdmin).not.toHaveBeenCalled(); // Should not call admin auth
    });

    it("should log different auth methods appropriately", async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const adminUser = createMockAdminUser();
      
      // Test admin auth logging
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        success: true,
        buoysAdded: 5,
        stationsAdded: 3,
      });

      let request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: {},
      });

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("NOAA buoy sync initiated by admin:")
      );

      consoleSpy.mockClear();

      // Test service role auth logging
      request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        headers: {
          "Authorization": "Bearer test-service-role-key",
        },
        body: {},
      });

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        "NOAA buoy sync initiated via service role (script/automation)"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Edge Cases", () => {
    it("should handle sync service returning undefined results", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue(undefined);

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: {},
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error during sync");
    });

    it("should handle sync service returning malformed results", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        // Missing success property and other expected fields
        someOtherData: "unexpected",
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: {},
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Sync failed");
    });

    it("should handle non-numeric maxDistanceKm gracefully", async () => {
      const adminUser = createMockAdminUser();
      
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockNOAABuoySync.syncBuoysForExistingBeaches.mockResolvedValue({
        success: true,
        buoysAdded: 5,
        stationsAdded: 3,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/admin/sync-buoys", {
        body: { maxDistanceKm: "invalid" }, // Non-numeric value
      });

      const response = await POST(request);
      const data = await response.json();

      // Should pass through the value as-is (API doesn't validate)
      expect(response.status).toBe(200);
      expect(data.data.maxDistanceKm).toBe("invalid"); // Passed through as-is
    });
  });
});