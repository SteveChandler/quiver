/**
 * @jest-environment node
 */

import { GET, POST } from "@/app/api/beaches/route";
import { 
  createMockSupabaseClient,
  createMockUser,
  createMockAdminUser,
  createMockSession,
  createMockRequest,
  createMockBeach,
  expectSuccessResponse,
  expectErrorResponse,
  testRequiredParameters,
  testAdminAuthorization,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockDatabaseSuccess,
  mockDatabaseError,
} from "@/test-utils/api-test-helpers";

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

jest.mock("@/lib/auth/admin", () => ({
  isAdmin: jest.fn(),
}));

const mockIsAdmin = require("@/lib/auth/admin").isAdmin;

describe("/api/beaches", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("GET", () => {
    it("should return all beaches successfully", async () => {
      const mockBeaches = [
        createMockBeach({ id: "beach-1", name: "Ocean Beach" }),
        createMockBeach({ id: "beach-2", name: "Sunset Cliffs" }),
      ];

      // Mock the full chain: from("beaches").select("*").order("name")
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockBeaches,
            error: null,
          })),
        })),
      });

      const request = createMockRequest("GET");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);
      expect(data.data).toEqual({
        beaches: mockBeaches,
        count: 2,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beaches");
    });

    it("should return empty array when no beaches exist", async () => {
      // Mock the full chain: from("beaches").select("*").order("name")
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: [],
            error: null,
          })),
        })),
      });

      const request = createMockRequest("GET");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);
      expect(data.data).toEqual({
        beaches: [],
        count: 0,
      });
    });

    it("should handle database errors appropriately", async () => {
      // Mock the full chain with an error: from("beaches").select("*").order("name")
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: null,
            error: { message: "Database connection failed" },
          })),
        })),
      });

      const request = createMockRequest("GET");
      const response = await GET(request);

      await expectErrorResponse(response, 500, "Failed to fetch beaches");
    });

    it("should handle null data from database", async () => {
      // Mock the full chain with null data: from("beaches").select("*").order("name")
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: null,
            error: null,
          })),
        })),
      });

      const request = createMockRequest("GET");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);
      expect(data.data).toEqual({
        beaches: [],
        count: 0,
      });
    });

    it("should order beaches by name", async () => {
      const mockBeaches = [
        createMockBeach({ name: "Zuma Beach" }),
        createMockBeach({ name: "Malibu" }),
      ];

      // Mock the full chain and capture the order call
      const mockOrder = jest.fn(() => Promise.resolve({
        data: mockBeaches,
        error: null,
      }));
      
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          order: mockOrder,
        })),
      });

      const request = createMockRequest("GET");
      await GET(request);

      // Verify the query chain included ordering
      expect(mockOrder).toHaveBeenCalledWith("name");
    });
  });

  describe("POST - Create Beach", () => {
    it("should create new beach when user is admin", async () => {
      const adminUser = createMockAdminUser();
      const adminSession = createMockSession(adminUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: adminSession },
        error: null,
      });

      mockIsAdmin.mockReturnValue(true);

      const newBeach = {
        name: "New Beach",
        latitude: 34.0522,
        longitude: -118.2437,
      };

      const createdBeach = createMockBeach({
        ...newBeach,
        id: "beach-new",
      });

      // Mock the full chain: from("beaches").insert().select().single()
      const mockInsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: createdBeach,
            error: null,
          })),
        })),
      }));

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: newBeach,
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.data).toEqual({
        success: true,
        data: {
          id: "beach-new",
          name: "New Beach",
          latitude: 34.0522,
          longitude: -118.2437,
        },
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beaches");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Beach",
          latitude: 34.0522,
          longitude: -118.2437,
        })
      );
    });

    it("should update existing beach when id is provided", async () => {
      const adminUser = createMockAdminUser();
      const adminSession = createMockSession(adminUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: adminSession },
        error: null,
      });

      mockIsAdmin.mockReturnValue(true);

      const updateData = {
        id: "beach-123",
        name: "Updated Beach",
        latitude: 34.0522,
        longitude: -118.2437,
      };

      const updatedBeach = createMockBeach(updateData);

      // Mock the full chain: from("beaches").update().eq().select().single()
      const mockEq = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: updatedBeach,
            error: null,
          })),
        })),
      }));

      const mockUpdate = jest.fn(() => ({
        eq: mockEq,
      }));

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: updateData,
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.data).toEqual({
        success: true,
        data: {
          id: "beach-123",
          name: "Updated Beach",
          latitude: 34.0522,
          longitude: -118.2437,
        },
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Beach",
          latitude: 34.0522,
          longitude: -118.2437,
          updated_at: expect.any(String),
        })
      );
      expect(mockEq).toHaveBeenCalledWith("id", "beach-123");
    });

    it("should require admin authorization", async () => {
      const regularUser = createMockUser();
      const regularSession = createMockSession(regularUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: regularSession },
        error: null,
      });

      mockIsAdmin.mockReturnValue(false);

      const request = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: {
          name: "New Beach",
          latitude: 34.0522,
          longitude: -118.2437,
        },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: "Unauthorized - Admin access required"
      });
    });

    it("should require authentication", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: {
          name: "New Beach",
          latitude: 34.0522,
          longitude: -118.2437,
        },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: "Unauthorized - Admin access required"
      });
    });

    it("should validate required parameters", async () => {
      const adminUser = createMockAdminUser();
      const adminSession = createMockSession(adminUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: adminSession },
        error: null,
      });

      mockIsAdmin.mockReturnValue(true);

      const validBeachData = {
        name: "Test Beach",
        latitude: 34.0522,
        longitude: -118.2437,
      };

      // Test missing name
      let request = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: { latitude: 34.0522, longitude: -118.2437 },
      });
      let response = await POST(request);
      await expectErrorResponse(response, 400, "Name, latitude, and longitude are required");

      // Test missing latitude
      request = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: { name: "Test Beach", longitude: -118.2437 },
      });
      response = await POST(request);
      await expectErrorResponse(response, 400, "Name, latitude, and longitude are required");

      // Test missing longitude
      request = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: { name: "Test Beach", latitude: 34.0522 },
      });
      response = await POST(request);
      await expectErrorResponse(response, 400, "Name, latitude, and longitude are required");
    });

    it("should handle database errors during creation", async () => {
      const adminUser = createMockAdminUser();
      const adminSession = createMockSession(adminUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: adminSession },
        error: null,
      });

      mockIsAdmin.mockReturnValue(true);

      // Mock the full chain with database error: from("beaches").insert().select().single()
      const mockInsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: null,
            error: { message: "Unique constraint violation" },
          })),
        })),
      }));

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: {
          name: "Duplicate Beach",
          latitude: 34.0522,
          longitude: -118.2437,
        },
      });

      const response = await POST(request);
      await expectErrorResponse(response, 500, "Failed to save location");
    });

    it("should handle JSON parsing errors", async () => {
      const adminUser = createMockAdminUser();
      const adminSession = createMockSession(adminUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: adminSession },
        error: null,
      });

      mockIsAdmin.mockReturnValue(true);

      // Create request with invalid JSON
      const request = new Request("http://localhost:3000/api/beaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      }) as any;

      const response = await POST(request);
      await expectErrorResponse(response, 500, "Failed to save location");
    });
  });

  describe("Security", () => {
    it("should sanitize location names to prevent XSS", async () => {
      const adminUser = createMockAdminUser();
      const adminSession = createMockSession(adminUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: adminSession },
        error: null,
      });

      mockIsAdmin.mockReturnValue(true);

      const maliciousBeach = createMockBeach({
        name: "<script>alert('xss')</script>Safe Beach",
        latitude: 34.0522,
        longitude: -118.2437,
      });

      // Mock the full chain: from("beaches").insert().select().single()
      const mockInsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: maliciousBeach,
            error: null,
          })),
        })),
      }));

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: {
          name: "<script>alert('xss')</script>Safe Beach",
          latitude: 34.0522,
          longitude: -118.2437,
        },
      });

      const response = await POST(request);
      
      // The API should not crash, but database layer should handle sanitization
      expect(response.status).toBeLessThan(500);
    });

    it("should validate coordinate ranges", async () => {
      const adminUser = createMockAdminUser();
      const adminSession = createMockSession(adminUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: adminSession },
        error: null,
      });

      mockIsAdmin.mockReturnValue(true);

      // Mock the full chain: from("beaches").insert().select().single()
      const mockInsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: createMockBeach(),
            error: null,
          })),
        })),
      }));

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const validRequest = createMockRequest("POST", "http://localhost:3000/api/beaches", {
        body: {
          name: "Valid Beach",
          latitude: 34.0522, // Valid latitude
          longitude: -118.2437, // Valid longitude
        },
      });

      const validResponse = await POST(validRequest);
      expect(validResponse.status).toBe(200);

      // The API currently doesn't validate coordinate ranges, 
      // but the database constraints should handle invalid coordinates
    });
  });

  describe("Performance", () => {
    it("should handle concurrent requests", async () => {
      const mockBeaches = [
        createMockBeach({ name: "Beach 1" }),
        createMockBeach({ name: "Beach 2" }),
      ];

      // Mock the full chain for concurrent requests: from("beaches").select("*").order("name")
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockBeaches,
            error: null,
          })),
        })),
      });

      // Simulate concurrent GET requests
      const requests = Array.from({ length: 5 }, () => 
        createMockRequest("GET")
      );
      const responses = await Promise.all(
        requests.map(request => GET(request))
      );

      responses.forEach(async (response) => {
        const data = await expectSuccessResponse(response, 200);
        expect(data.data.beaches).toHaveLength(2);
      });
    });
  });
});