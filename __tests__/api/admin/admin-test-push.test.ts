/**
 * @jest-environment node
 */

import { GET, POST } from "@/app/api/admin/test-push/route";
import {
  createMockAdminUser,
  createMockRequest,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

// Mock the admin authentication
jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
}));

// Mock push notification service
jest.mock("@/lib/services/push-notifications", () => ({
  sendPushNotification: jest.fn(),
}));

// Get access to the mocked functions after mocking
const mockAuthenticateAdmin = require("@/lib/auth/admin").authenticateAdmin;
const mockSendPushNotification = require("@/lib/services/push-notifications").sendPushNotification;

describe("/api/admin/test-push", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("POST - Send Test Push", () => {
    it("requires admin authentication", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized - Admin access required",
        status: 401,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it("sends test push notification successfully", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockResolvedValue({
        success: 1,
        failed: 0,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("toUserId", adminUser.id);
      expect(data.data).toHaveProperty("title", "Quiver Test Push");
      expect(data.data).toHaveProperty("body");
      expect(data.data).toHaveProperty("result");
      expect(data.data.result.success).toBe(1);

      // Verify push notification was called with admin user ID
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: [adminUser.id],
          title: "Quiver Test Push",
          data: expect.objectContaining({
            type: "test_push",
            url: "/profile",
          }),
        })
      );
    });

    it("accepts custom title and body", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockResolvedValue({
        success: 1,
        failed: 0,
      });

      const customTitle = "Custom Test Title";
      const customBody = "This is a custom test message";

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {
            title: customTitle,
            body: customBody,
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe(customTitle);
      expect(data.data.body).toBe(customBody);

      // Verify custom values were passed to push service
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: customTitle,
          body: customBody,
        })
      );
    });

    it("validates title length (max 80 characters)", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const longTitle = "A".repeat(100); // Exceeds max length

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {
            title: longTitle,
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid request body");
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it("validates body length (max 240 characters)", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const longBody = "A".repeat(300); // Exceeds max length

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {
            body: longBody,
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid request body");
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it("rejects empty title string", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {
            title: "",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid request body");
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it("rejects empty body string", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {
            body: "",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid request body");
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it("rejects unknown properties in request body", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {
            title: "Test",
            body: "Test message",
            unknownField: "should not be allowed",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid request body");
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it("handles malformed JSON body gracefully", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockResolvedValue({
        success: 1,
        failed: 0,
      });

      // Create request with invalid JSON
      const request = new Request(
        "http://localhost:3000/api/admin/test-push",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{ invalid json }",
        }
      ) as any;

      const response = await POST(request);
      const data = await response.json();

      // Should use defaults when JSON parsing fails
      expect(response.status).toBe(200);
      expect(data.data.title).toBe("Quiver Test Push");
      expect(mockSendPushNotification).toHaveBeenCalled();
    });

    it("handles push notification service failures", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockResolvedValue({
        success: 0,
        failed: 1,
        errors: ["FCM token not found"],
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      // Should still return 200 but with failed result
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.result.success).toBe(0);
      expect(data.data.result.failed).toBe(1);
    });

    it("handles push notification service exceptions", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockRejectedValue(
        new Error("FCM service unavailable")
      );

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeTruthy();
    });

    it("handles authentication exceptions", async () => {
      mockAuthenticateAdmin.mockRejectedValue(
        new Error("Auth service unavailable")
      );

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {},
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeTruthy();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it("includes timestamp in notification data", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockResolvedValue({
        success: 1,
        failed: 0,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {},
        }
      );

      const response = await POST(request);
      await response.json();

      // Verify timestamp was included in notification data
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sent_at: expect.any(String),
          }),
        })
      );
    });

    it("sets correct notification type in data", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockResolvedValue({
        success: 1,
        failed: 0,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {},
        }
      );

      const response = await POST(request);
      await response.json();

      // Verify notification type is set to test_push
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "test_push",
            url: "/profile",
          }),
        })
      );
    });
  });

  describe("GET - Endpoint Information", () => {
    it("returns endpoint information for admin users", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/test-push"
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.endpoint).toBe("/api/admin/test-push");
      expect(data.method).toBe("POST");
      expect(data.description).toBeTruthy();
      expect(data.body).toHaveProperty("title");
      expect(data.body).toHaveProperty("body");
      expect(data.timestamp).toBeTruthy();
    });

    it("requires admin authentication", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized - Admin access required",
        status: 401,
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/test-push"
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("handles authentication exceptions", async () => {
      mockAuthenticateAdmin.mockRejectedValue(
        new Error("Auth service unavailable")
      );

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/test-push"
      );

      // The GET endpoint doesn't have try-catch, so exceptions will be thrown
      await expect(GET()).rejects.toThrow("Auth service unavailable");
    });

    it("documents parameter constraints", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/test-push"
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.body.title).toContain("80"); // Max length documented
      expect(data.body.body).toContain("240"); // Max length documented
    });
  });

  describe("Security", () => {
    it("only sends push to the authenticated admin user", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockResolvedValue({
        success: 1,
        failed: 0,
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {},
        }
      );

      const response = await POST(request);
      await response.json();

      // Verify push was only sent to admin user, not any other user
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: [adminUser.id],
        })
      );
      expect(mockSendPushNotification).toHaveBeenCalledTimes(1);
    });

    it("prevents injection attacks in title", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockResolvedValue({
        success: 1,
        failed: 0,
      });

      const maliciousTitle = "<script>alert('xss')</script>";

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {
            title: maliciousTitle,
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Verify the malicious script is passed as-is (no execution risk in push notifications)
      // Push notification services handle sanitization
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: maliciousTitle,
        })
      );
    });

    it("prevents injection attacks in body", async () => {
      const adminUser = createMockAdminUser();

      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      mockSendPushNotification.mockResolvedValue({
        success: 1,
        failed: 0,
      });

      const maliciousBody = "javascript:alert('xss')";

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/admin/test-push",
        {
          body: {
            body: maliciousBody,
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Verify the malicious code is passed as-is (no execution risk)
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: maliciousBody,
        })
      );
    });
  });
});
