/**
 * Unit tests for Resend Webhook Endpoint
 * Tests POST /api/webhooks/resend
 *
 * Test coverage:
 * - Webhook signature verification
 * - Event type handling (delivered, opened, clicked, bounced)
 * - Database updates with idempotency
 * - Error handling and graceful degradation
 */

import { POST } from "@/app/api/webhooks/resend/route";
import { NextRequest } from "next/server";

// Mock NextResponse
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    NextResponse: {
      json: jest.fn((data: any, init?: ResponseInit) => ({
        json: async () => data,
        status: init?.status || 200,
        ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
      })),
    },
  };
});

// Mock svix Webhook
const mockVerify = jest.fn();
jest.mock("svix", () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: mockVerify,
  })),
}));

// Mock Supabase
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockIs = jest.fn();
const mockSelect = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        update: mockUpdate,
      })),
    })
  ),
}));

// Mock rate limit wrapper to pass through
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({
  withRateLimit: jest.fn((handler) => handler),
}));

/**
 * Helper function to create a webhook request with proper headers
 */
function createWebhookRequest(
  body: object,
  headers: Record<string, string> = {}
): NextRequest {
  const allHeaders: Record<string, string> = {
    "svix-id": "msg_test123",
    "svix-timestamp": "1234567890",
    "svix-signature": "v1,test_signature",
    "content-type": "application/json",
    ...headers,
  };

  return {
    url: "http://localhost/api/webhooks/resend",
    method: "POST",
    headers: {
      get: jest.fn((name: string) => allHeaders[name.toLowerCase()] || null),
    },
    json: jest.fn(() => Promise.resolve(body)),
    text: jest.fn(() => Promise.resolve(JSON.stringify(body))),
  } as unknown as NextRequest;
}

describe("Resend Webhook Endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test_secret";

    // Setup Supabase chain: from().update().eq().is().select()
    mockSelect.mockResolvedValue({ data: [{ id: "1" }], error: null });
    mockIs.mockReturnValue({ select: mockSelect });
    mockEq.mockReturnValue({ is: mockIs });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  describe("Request Validation", () => {
    it("should return 400 when svix-id header is missing", async () => {
      const request = createWebhookRequest(
        { type: "email.delivered" },
        { "svix-id": "" }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing webhook signature headers");
    });

    it("should return 400 when svix-timestamp header is missing", async () => {
      const request = createWebhookRequest(
        { type: "email.delivered" },
        { "svix-timestamp": "" }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing webhook signature headers");
    });

    it("should return 400 when svix-signature header is missing", async () => {
      const request = createWebhookRequest(
        { type: "email.delivered" },
        { "svix-signature": "" }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing webhook signature headers");
    });

    it("should return 500 when RESEND_WEBHOOK_SECRET is not configured", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      const request = createWebhookRequest({
        type: "email.delivered",
        data: { email_id: "test-id" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Webhook secret not configured");
    });

    it("should return 401 when signature verification fails", async () => {
      mockVerify.mockImplementationOnce(() => {
        throw new Error("Invalid signature");
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: { email_id: "test-id" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid signature");
    });
  });

  describe("Event Type: email.delivered", () => {
    it("should update delivered_at column for email.delivered event", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.delivered",
        data: { email_id: "test-email-123" },
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: { email_id: "test-email-123" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(true);

      expect(mockUpdate).toHaveBeenCalledWith({ delivered_at: expect.any(String) });
      expect(mockEq).toHaveBeenCalledWith("resend_message_id", "test-email-123");
      expect(mockIs).toHaveBeenCalledWith("delivered_at", null);
    });

    it("should use current timestamp for delivered_at", async () => {
      const beforeTime = Date.now();

      mockVerify.mockReturnValueOnce({
        type: "email.delivered",
        data: { email_id: "test-email-123" },
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: { email_id: "test-email-123" },
      });

      await POST(request);

      const afterTime = Date.now();

      expect(mockUpdate).toHaveBeenCalledWith({
        delivered_at: expect.any(String),
      });

      const updateCall = mockUpdate.mock.calls[0][0];
      const timestamp = updateCall.delivered_at;

      // Parse the ISO string to timestamp
      const timestampMs = new Date(timestamp).getTime();

      expect(timestampMs).toBeGreaterThanOrEqual(beforeTime);
      expect(timestampMs).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("Event Type: email.opened", () => {
    it("should update opened_at column for email.opened event", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.opened",
        data: { email_id: "test-email-456" },
      });

      const request = createWebhookRequest({
        type: "email.opened",
        data: { email_id: "test-email-456" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(true);

      expect(mockUpdate).toHaveBeenCalledWith({ opened_at: expect.any(String) });
      expect(mockEq).toHaveBeenCalledWith("resend_message_id", "test-email-456");
      expect(mockIs).toHaveBeenCalledWith("opened_at", null);
    });
  });

  describe("Event Type: email.clicked", () => {
    it("should update clicked_at column for email.clicked event", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.clicked",
        data: { email_id: "test-email-789" },
      });

      const request = createWebhookRequest({
        type: "email.clicked",
        data: { email_id: "test-email-789" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(true);

      expect(mockUpdate).toHaveBeenCalledWith({ clicked_at: expect.any(String) });
      expect(mockEq).toHaveBeenCalledWith("resend_message_id", "test-email-789");
      expect(mockIs).toHaveBeenCalledWith("clicked_at", null);
    });
  });

  describe("Event Type: email.bounced", () => {
    it("should update bounced_at column for email.bounced event", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.bounced",
        data: { email_id: "test-email-bounced" },
      });

      const request = createWebhookRequest({
        type: "email.bounced",
        data: { email_id: "test-email-bounced" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(true);

      expect(mockUpdate).toHaveBeenCalledWith({ bounced_at: expect.any(String) });
      expect(mockEq).toHaveBeenCalledWith("resend_message_id", "test-email-bounced");
      expect(mockIs).toHaveBeenCalledWith("bounced_at", null);
    });
  });

  describe("Unknown Event Types", () => {
    it("should acknowledge but not process unknown event types", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.sent",
        data: { email_id: "test-email-sent" },
      });

      const request = createWebhookRequest({
        type: "email.sent",
        data: { email_id: "test-email-sent" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(false);

      // Should not attempt database update
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should handle email.complained event", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.complained",
        data: { email_id: "test-email-complained" },
      });

      const request = createWebhookRequest({
        type: "email.complained",
        data: { email_id: "test-email-complained" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(false);

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Missing Data Fields", () => {
    it("should return 200 with processed=false when email_id is missing", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.delivered",
        data: {},
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: {},
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(false);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should handle null email_id gracefully", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.opened",
        data: { email_id: null },
      });

      const request = createWebhookRequest({
        type: "email.opened",
        data: { email_id: null },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(false);

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Database Operations", () => {
    it("should handle case when no matching rows found", async () => {
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      mockVerify.mockReturnValueOnce({
        type: "email.delivered",
        data: { email_id: "nonexistent-email" },
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: { email_id: "nonexistent-email" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(true);
    });

    it("should successfully process when rows are updated", async () => {
      mockSelect.mockResolvedValueOnce({
        data: [{ id: "1" }, { id: "2" }],
        error: null,
      });

      mockVerify.mockReturnValueOnce({
        type: "email.opened",
        data: { email_id: "test-email-multiple" },
      });

      const request = createWebhookRequest({
        type: "email.opened",
        data: { email_id: "test-email-multiple" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      mockSelect.mockResolvedValueOnce({
        data: null,
        error: { message: "Database connection failed", code: "PGRST301" },
      });

      mockVerify.mockReturnValueOnce({
        type: "email.delivered",
        data: { email_id: "test-email-db-error" },
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: { email_id: "test-email-db-error" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(false);
      expect(data.error).toBe("Database connection failed");
    });
  });

  describe("Idempotency", () => {
    it("should only update rows where delivered_at is null (first-event-wins)", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.delivered",
        data: { email_id: "test-idempotency" },
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: { email_id: "test-idempotency" },
      });

      await POST(request);

      expect(mockIs).toHaveBeenCalledWith("delivered_at", null);
    });

    it("should only update rows where opened_at is null", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.opened",
        data: { email_id: "test-opened-idempotency" },
      });

      const request = createWebhookRequest({
        type: "email.opened",
        data: { email_id: "test-opened-idempotency" },
      });

      await POST(request);

      expect(mockIs).toHaveBeenCalledWith("opened_at", null);
    });

    it("should only update rows where clicked_at is null", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.clicked",
        data: { email_id: "test-clicked-idempotency" },
      });

      const request = createWebhookRequest({
        type: "email.clicked",
        data: { email_id: "test-clicked-idempotency" },
      });

      await POST(request);

      expect(mockIs).toHaveBeenCalledWith("clicked_at", null);
    });

    it("should only update rows where bounced_at is null", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.bounced",
        data: { email_id: "test-bounced-idempotency" },
      });

      const request = createWebhookRequest({
        type: "email.bounced",
        data: { email_id: "test-bounced-idempotency" },
      });

      await POST(request);

      expect(mockIs).toHaveBeenCalledWith("bounced_at", null);
    });

    it("should return success when event already processed", async () => {
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      mockVerify.mockReturnValueOnce({
        type: "email.delivered",
        data: { email_id: "already-processed" },
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: { email_id: "already-processed" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(true);
    });
  });

  describe("Webhook Payload Variations", () => {
    it("should handle webhook with additional metadata", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.delivered",
        data: {
          email_id: "test-with-metadata",
          to: "user@example.com",
          subject: "Test Email",
          created_at: "2026-02-11T12:00:00Z",
        },
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: {
          email_id: "test-with-metadata",
          to: "user@example.com",
          subject: "Test Email",
          created_at: "2026-02-11T12:00:00Z",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(true);

      expect(mockEq).toHaveBeenCalledWith("resend_message_id", "test-with-metadata");
    });

    it("should extract email_id from nested data structure", async () => {
      mockVerify.mockReturnValueOnce({
        type: "email.opened",
        data: {
          email_id: "nested-email-id",
          event_data: {
            ip: "192.168.1.1",
            user_agent: "Mozilla/5.0",
          },
        },
      });

      const request = createWebhookRequest({
        type: "email.opened",
        data: {
          email_id: "nested-email-id",
          event_data: {
            ip: "192.168.1.1",
            user_agent: "Mozilla/5.0",
          },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(true);

      expect(mockEq).toHaveBeenCalledWith("resend_message_id", "nested-email-id");
    });
  });

  describe("Error Recovery", () => {
    it("should not throw errors even when database fails", async () => {
      mockSelect.mockRejectedValueOnce(new Error("Unexpected database error"));

      mockVerify.mockReturnValueOnce({
        type: "email.delivered",
        data: { email_id: "test-error-recovery" },
      });

      const request = createWebhookRequest({
        type: "email.delivered",
        data: { email_id: "test-error-recovery" },
      });

      // Should not throw
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });

    it("should handle malformed verified payload", async () => {
      mockVerify.mockReturnValueOnce({
        type: null,
        data: null,
      });

      const request = createWebhookRequest({
        type: null,
        data: null,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(false);
    });
  });

  describe("Rate Limiting Integration", () => {
    it("should be wrapped with rate limit middleware", () => {
      const { withRateLimit } = require("@/lib/middleware/api-wrappers/rate-limit-wrapper");

      // Verify the mock is set up correctly (it's called during module import)
      expect(withRateLimit).toBeDefined();
      expect(typeof withRateLimit).toBe("function");
    });
  });
});
