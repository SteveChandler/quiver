/**
 * @jest-environment node
 */

import { GET, POST } from "@/app/api/admin/cleanup-inactive-buoys/route";
import {
  createMockRequest,
  setupApiTestEnvironment,
  mockEnvVars,
  mockNodeEnv,
} from "@/test-utils/api-test-helpers";

// Mock admin authentication (withBearerAuth calls this as fallback)
jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
}));

// Mock Supabase service role client (withBearerAuth creates this)
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({})),
}));

// Mock the InactiveBuoyCleanup service
const mockCleanupInactiveBuoys = jest.fn();

jest.mock("@/lib/services/inactive-buoy-cleanup", () => ({
  InactiveBuoyCleanup: jest.fn().mockImplementation(() => ({
    cleanupInactiveBuoys: mockCleanupInactiveBuoys,
  })),
}));

const mockAuthenticateAdmin = require("@/lib/auth/admin").authenticateAdmin;

describe("/api/admin/cleanup-inactive-buoys", () => {
  let cleanup: () => void;
  let restoreEnv: () => void;
  let restoreNodeEnv: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;

    restoreEnv = mockEnvVars({
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    });

    // Default to production mode for auth checks
    restoreNodeEnv = mockNodeEnv("production");

    jest.clearAllMocks();

    // Default: authenticateAdmin fails (tests that need admin auth override this)
    mockAuthenticateAdmin.mockResolvedValue({
      success: false,
      error: "Authentication required",
      status: 401,
    });
  });

  afterEach(() => {
    cleanup?.();
    restoreEnv?.();
    restoreNodeEnv?.();
  });

  describe("POST - Cleanup Inactive Buoys", () => {
    it("requires authentication in production", async () => {
      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Authentication required");
      expect(mockCleanupInactiveBuoys).not.toHaveBeenCalled();
    });

    it("allows requests with bearer token in production", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 10,
        deactivated: 3,
        removed: 0,
        inactive_buoys: [],
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCleanupInactiveBuoys).toHaveBeenCalled();
    });

    it("requires bearer token or admin auth in all environments", async () => {
      restoreNodeEnv();
      restoreNodeEnv = mockNodeEnv("development");

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      // withBearerAuth requires auth regardless of environment
      expect(response.status).toBe(401);
      expect(data.error).toContain("Authentication required");
      expect(mockCleanupInactiveBuoys).not.toHaveBeenCalled();
    });

    it("cleans up inactive buoys successfully (deactivate mode)", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 15,
        deactivated: 5,
        removed: 0,
        inactive_buoys: [
          {
            buoy_uuid: "buoy-1",
            buoy_name: "Station 46222",
            kind: "observations",
            coordinates: "(33.618, -117.913)",
            failure_count: 3,
            last_successful_update: null,
            last_attempted_update: "2024-01-01T00:00:00Z",
          },
        ],
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {
            dryRun: false,
            remove: false,
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tested).toBe(15);
      expect(data.deactivated).toBe(5);
      expect(data.removed).toBe(0);
      expect(data.inactive_buoys).toHaveLength(1);
      expect(data.message).toContain("Deactivated 5 inactive buoys");
      expect(data.timestamp).toBeTruthy();

      expect(mockCleanupInactiveBuoys).toHaveBeenCalledWith({
        remove: false,
        dryRun: false,
      });
    });

    it("cleans up inactive buoys successfully (remove mode)", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 15,
        deactivated: 0,
        removed: 5,
        inactive_buoys: [],
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {
            dryRun: false,
            remove: true,
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tested).toBe(15);
      expect(data.deactivated).toBe(0);
      expect(data.removed).toBe(5);
      expect(data.message).toContain("Removed 5 inactive buoys");

      expect(mockCleanupInactiveBuoys).toHaveBeenCalledWith({
        remove: true,
        dryRun: false,
      });
    });

    it("runs in dry run mode without making changes", async () => {
      const inactiveBuoys = [
        {
          buoy_uuid: "buoy-1",
          buoy_name: "Station 46222",
          kind: "observations",
          coordinates: "(33.618, -117.913)",
          failure_count: 5,
          last_successful_update: null,
          last_attempted_update: "2024-01-01T00:00:00Z",
        },
        {
          buoy_uuid: "buoy-2",
          buoy_name: "Station 46086",
          kind: "forecast",
          coordinates: "(32.491, -117.392)",
          failure_count: 3,
          last_successful_update: "2023-12-01T00:00:00Z",
          last_attempted_update: "2024-01-01T00:00:00Z",
        },
      ];

      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 20,
        deactivated: 0,
        removed: 0,
        inactive_buoys: inactiveBuoys,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {
            dryRun: true,
            remove: false,
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tested).toBe(20);
      expect(data.deactivated).toBe(0);
      expect(data.removed).toBe(0);
      expect(data.inactive_buoys).toHaveLength(2);
      expect(data.message).toContain("Found 2 inactive buoys");

      expect(mockCleanupInactiveBuoys).toHaveBeenCalledWith({
        remove: false,
        dryRun: true,
      });
    });

    it("defaults to deactivate mode when no options provided", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 10,
        deactivated: 2,
        removed: 0,
        inactive_buoys: [],
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockCleanupInactiveBuoys).toHaveBeenCalledWith({
        remove: false, // Default
        dryRun: false, // Default
      });
    });

    it("handles cleanup service failures", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue({
        success: false,
        tested: 0,
        deactivated: 0,
        removed: 0,
        inactive_buoys: [],
        error: "Failed to connect to database",
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Cleanup failed");
      expect(data.details).toBe("Failed to connect to database");
    });

    it("handles cleanup service exceptions", async () => {
      mockCleanupInactiveBuoys.mockRejectedValue(
        new Error("Service unavailable")
      );

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Buoy cleanup error");
    });

    it("handles malformed JSON body gracefully", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 10,
        deactivated: 2,
        removed: 0,
        inactive_buoys: [],
      });

      // Create request with invalid JSON
      const request = new Request(
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-service-role-key",
          },
          body: "{ invalid json }",
        }
      ) as any;

      const response = await POST(request);
      const data = await response.json();

      // withBearerAuth wrapper catches and returns custom error message
      expect(response.status).toBe(500);
      expect(data.error).toBe("Buoy cleanup error");
    });

    it("logs cleanup mode correctly", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 10,
        deactivated: 3,
        removed: 0,
        inactive_buoys: [],
      });

      // Test deactivate mode
      let request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: { dryRun: false, remove: false },
        }
      );

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Mode: DEACTIVATE")
      );

      consoleSpy.mockClear();

      // Test remove mode
      request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: { dryRun: false, remove: true },
        }
      );

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Mode: REMOVE")
      );

      consoleSpy.mockClear();

      // Test dry run mode
      request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: { dryRun: true, remove: false },
        }
      );

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Mode: DRY RUN")
      );

      consoleSpy.mockRestore();
    });

    it("returns detailed inactive buoy information", async () => {
      const inactiveBuoys = [
        {
          buoy_uuid: "buoy-1",
          buoy_name: "Station 46222",
          kind: "observations",
          coordinates: "(33.618, -117.913)",
          failure_count: 5,
          last_successful_update: null,
          last_attempted_update: "2024-01-01T00:00:00Z",
        },
      ];

      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 10,
        deactivated: 1,
        removed: 0,
        inactive_buoys: inactiveBuoys,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: { dryRun: false, remove: false },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.inactive_buoys).toHaveLength(1);
      expect(data.inactive_buoys[0]).toHaveProperty("buoy_uuid");
      expect(data.inactive_buoys[0]).toHaveProperty("buoy_name");
      expect(data.inactive_buoys[0]).toHaveProperty("kind");
      expect(data.inactive_buoys[0]).toHaveProperty("coordinates");
      expect(data.inactive_buoys[0]).toHaveProperty("failure_count");
    });

    it("handles zero inactive buoys found", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 25,
        deactivated: 0,
        removed: 0,
        inactive_buoys: [],
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: { dryRun: true },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("Found 0 inactive buoys");
      expect(data.inactive_buoys).toHaveLength(0);
    });
  });

  describe("GET - Endpoint Information", () => {
    it("returns endpoint documentation with bearer auth", async () => {
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain("Use POST");
      expect(data.endpoint).toBe("/api/admin/cleanup-inactive-buoys");
      expect(data.method).toBe("POST");
      expect(data.body).toHaveProperty("dryRun");
      expect(data.body).toHaveProperty("remove");
    });

    it("documents dryRun parameter", async () => {
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.body.dryRun).toContain("identify without removing");
    });

    it("documents remove parameter", async () => {
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.body.remove).toContain("remove completely");
      expect(data.body.remove).toContain("deactivate");
    });
  });

  describe("Security", () => {
    it("requires bearer token format in production", async () => {
      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "InvalidFormat",
          },
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Authentication required");
      expect(mockCleanupInactiveBuoys).not.toHaveBeenCalled();
    });

    it("rejects requests with missing authorization header in production", async () => {
      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Authentication required");
      expect(mockCleanupInactiveBuoys).not.toHaveBeenCalled();
    });

    it("requires auth even in development mode (withBearerAuth is env-agnostic)", async () => {
      restoreNodeEnv();
      restoreNodeEnv = mockNodeEnv("development");

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Authentication required");
    });

    it("does not expose sensitive buoy data", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 10,
        deactivated: 2,
        removed: 0,
        inactive_buoys: [
          {
            buoy_uuid: "buoy-1",
            buoy_name: "Station 46222",
            kind: "observations",
            coordinates: "(33.618, -117.913)",
            failure_count: 3,
            last_successful_update: null,
            last_attempted_update: "2024-01-01T00:00:00Z",
          },
        ],
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify no sensitive data in response
      const responseStr = JSON.stringify(data);
      expect(responseStr).not.toMatch(/password/i);
      expect(responseStr).not.toMatch(/token/i);
      expect(responseStr).not.toMatch(/secret/i);
    });
  });

  describe("Edge Cases", () => {
    it("handles service returning undefined results", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue(undefined);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      // Accessing .success on undefined throws, caught by wrapper
      expect(data.error).toBe("Buoy cleanup error");
    });

    it("handles service returning null results", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue(null);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      // Accessing .success on null throws, caught by wrapper
      expect(data.error).toBe("Buoy cleanup error");
    });

    it("handles large number of inactive buoys", async () => {
      const largeBuoyList = Array.from({ length: 100 }, (_, i) => ({
        buoy_uuid: `buoy-${i}`,
        buoy_name: `Station ${46000 + i}`,
        kind: i % 2 === 0 ? "observations" : "forecast",
        coordinates: `(${33 + i * 0.01}, ${-117 + i * 0.01})`,
        failure_count: 3 + (i % 5),
        last_successful_update: null,
        last_attempted_update: new Date().toISOString(),
      }));

      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 200,
        deactivated: 100,
        removed: 0,
        inactive_buoys: largeBuoyList,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: { dryRun: true },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.inactive_buoys).toHaveLength(100);
    });

    it("handles mixed remove and dryRun flags (dryRun takes precedence)", async () => {
      mockCleanupInactiveBuoys.mockResolvedValue({
        success: true,
        tested: 10,
        deactivated: 0,
        removed: 0,
        inactive_buoys: [],
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/cleanup-inactive-buoys",
        {
          headers: {
            Authorization: "Bearer test-service-role-key",
          },
          body: {
            dryRun: true,
            remove: true, // Should be ignored when dryRun is true
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain("Found"); // Dry run message
      expect(data.deactivated).toBe(0);
      expect(data.removed).toBe(0);
    });
  });
});
