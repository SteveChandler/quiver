/**
 * Unit tests for Re-engagement Email Cron Job API
 * Tests the cron endpoint that sends "conditions are good" emails to inactive users
 *
 * Test coverage:
 * - Authentication and authorization
 * - Candidate fetching and processing
 * - Email sending with rate limiting
 * - Slot claim deduplication
 * - Error handling and graceful degradation
 * - Summary statistics
 */

import { GET } from "@/app/api/cron/reengagement-email/route";
import { NextRequest } from "next/server";

// Mock API response utilities
jest.mock("@/lib/api-utils", () => ({
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
  handleApiError: jest.fn((error) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      })
    ),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

// Mock Supabase client
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
      from: mockFrom,
    })
  ),
}));

// Mock Resend mailer
jest.mock("@/lib/mailer/client", () => {
  const mockSend = jest.fn();
  // Export so we can reference it in tests
  (global as any).__mockEmailsSend = mockSend;

  return {
    resend: {
      emails: {
        send: mockSend,
      },
    },
    MAIL_FROM: "Quiver <test@quiversurf.app>",
    MAIL_REPLY_TO: "Quiver <test@quiversurf.app>",
  };
});

// Mock email template
jest.mock("@/lib/mailer/templates/ReengagementEmail", () => ({
  ReengagementEmail: jest.fn(() => "ReengagementEmail"),
}));

describe("Re-engagement Email Cron Job API", () => {
  const mockRequest = (
    headers: Record<string, string> = {},
    url = "http://localhost/api/cron/reengagement-email"
  ) => {
    return {
      url,
      headers: {
        get: jest.fn((name: string) => headers[name] || null),
      },
      json: jest.fn(() => Promise.resolve({})),
    } as unknown as NextRequest;
  };

  // Get reference to the mock after module is loaded
  let mockEmailsSend: jest.Mock;

  beforeEach(() => {
    // Access the global reference set up in the mock
    mockEmailsSend = (global as any).__mockEmailsSend;
    jest.clearAllMocks();

    // Setup default Supabase mock chain for intel posts
    const mockChain = {
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      order: mockOrder,
      limit: mockLimit,
    };

    mockFrom.mockReturnValue(mockChain);
    mockSelect.mockReturnValue(mockChain);
    mockEq.mockReturnValue(mockChain);
    mockGte.mockReturnValue(mockChain);
    mockOrder.mockReturnValue(mockChain);
    mockLimit.mockResolvedValue({
      data: [],
      error: null,
    });

    // Default RPC responses
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    // Default Resend response
    mockEmailsSend.mockResolvedValue({
      id: "test-email-id",
    });
  });

  describe("Authentication", () => {
    it("should reject requests without valid cron authentication", async () => {
      const { validateCronRequest } = require("@/lib/api-utils");
      validateCronRequest.mockReturnValueOnce(false);

      const request = mockRequest({
        authorization: "Bearer invalid-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
      expect(data.details).toBe("Invalid cron authentication");
      expect(response.status).toBe(401);
    });

    it("should accept valid cron authentication", async () => {
      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it("should accept Vercel cron header", async () => {
      const request = mockRequest({
        "x-vercel-cron": "1",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
    });
  });

  describe("Candidate Processing", () => {
    it("should return empty summary when no candidates found", async () => {
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary).toEqual({
        candidates: 0,
        sent: 0,
        durationMs: expect.any(Number),
        skipped: {
          claimFailed: 0,
          sendFailed: 0,
        },
      });
    });

    it("should fetch candidates with correct RPC parameters", async () => {
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      await GET(request);

      expect(mockRpc).toHaveBeenCalledWith("get_reengagement_email_candidates", {
        p_inactive_days: 7,
        p_min_score: 7,
        p_dedupe_hours: 72,
        p_global_cooldown_hours: 48,
      });
    });

    it("should handle RPC error when fetching candidates", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to fetch re-engagement candidates");
    });

    it("should process multiple candidates", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach 1",
          beach_slug: "test-beach-1",
          conditions_score: 9,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: "08:00:00",
          best_window_end: "10:00:00",
          recommendation: "Go now!",
        },
        {
          user_id: "user-2",
          email: "user2@example.com",
          display_name: "User Two",
          home_beach_id: "beach-2",
          beach_name: "Test Beach 2",
          beach_slug: "test-beach-2",
          conditions_score: 8,
          surf_description: "Solid 2-3ft",
          wind_description: "Calm",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null }) // claim slot user-1
        .mockResolvedValueOnce({ data: true, error: null }); // claim slot user-2

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.candidates).toBe(2);
      expect(data.data.summary.sent).toBe(2);
      expect(mockEmailsSend).toHaveBeenCalledTimes(2);
    });
  });

  describe("Slot Claim Deduplication", () => {
    it("should skip candidate when slot claim fails", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: false, error: null }); // claim failed

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.candidates).toBe(1);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.claimFailed).toBe(1);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("should skip candidate when slot claim RPC errors", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: { message: "RPC error" } }); // claim error

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.claimFailed).toBe(1);
    });

    it("should call claim_forecast_delivery_slot with correct parameters", async () => {
      const candidates = [
        {
          user_id: "user-123",
          email: "test@example.com",
          display_name: "Test User",
          home_beach_id: "beach-456",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null }); // claim slot

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      await GET(request);

      expect(mockRpc).toHaveBeenCalledWith("claim_forecast_delivery_slot", {
        p_user_id: "user-123",
        p_beach_id: "beach-456",
        p_alert_type: "reengagement",
        p_dedupe_hours: 72,
      });
    });
  });

  describe("Email Sending", () => {
    it("should send email with correct parameters", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "John Doe",
          home_beach_id: "beach-1",
          beach_name: "Ocean Beach",
          beach_slug: "ocean-beach",
          conditions_score: 9,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: "08:00:00",
          best_window_end: "10:00:00",
          recommendation: "Go now!",
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null }); // claim slot

      // Mock intel posts
      mockLimit.mockResolvedValueOnce({
        data: [
          { tag: "waves", description: "Clean sets rolling through" },
          { tag: "wind", description: "Glassy in the morning" },
        ],
        error: null,
      });

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      await GET(request);

      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: "Quiver <test@quiversurf.app>",
        replyTo: "Quiver <test@quiversurf.app>",
        to: "user1@example.com",
        subject: "Perfect conditions at Ocean Beach today!",
        react: "ReengagementEmail", // Mocked component
      });
    });

    it("should use correct email subject based on score", async () => {
      const testCases = [
        { score: 9, expectedLabel: "Perfect" },
        { score: 8, expectedLabel: "Excellent" },
        { score: 7, expectedLabel: "Good" },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const candidates = [
          {
            user_id: "user-1",
            email: "test@example.com",
            display_name: "Test",
            home_beach_id: "beach-1",
            beach_name: "Test Beach",
            beach_slug: "test-beach",
            conditions_score: testCase.score,
            surf_description: "Test",
            wind_description: "Test",
            best_window_start: null,
            best_window_end: null,
            recommendation: null,
          },
        ];

        mockRpc
          .mockResolvedValueOnce({ data: candidates, error: null })
          .mockResolvedValueOnce({ data: true, error: null });

        mockLimit.mockResolvedValueOnce({ data: [], error: null });

        const request = mockRequest({ authorization: "Bearer valid" });
        await GET(request);

        expect(mockEmailsSend).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: `${testCase.expectedLabel} conditions at Test Beach today!`,
          })
        );
      }
    });

    it("should handle Resend send failures gracefully", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null }); // claim slot

      mockLimit.mockResolvedValueOnce({ data: [], error: null });
      mockEmailsSend.mockRejectedValueOnce(new Error("Resend API error"));

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.sendFailed).toBe(1);
    });

    it("should handle candidate processing errors gracefully", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockImplementationOnce(() => {
          throw new Error("Unexpected error");
        });

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.skipped.sendFailed).toBe(1);
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limit between email sends", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach 1",
          beach_slug: "test-beach-1",
          conditions_score: 9,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
        {
          user_id: "user-2",
          email: "user2@example.com",
          display_name: "User Two",
          home_beach_id: "beach-2",
          beach_name: "Test Beach 2",
          beach_slug: "test-beach-2",
          conditions_score: 8,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null }) // claim 1
        .mockResolvedValueOnce({ data: true, error: null }); // claim 2

      mockLimit
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const setTimeoutSpy = jest.spyOn(global, "setTimeout");

      const request = mockRequest({ authorization: "Bearer valid" });
      await GET(request);

      // Should have called setTimeout for rate limiting after first send
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 600);

      setTimeoutSpy.mockRestore();
    });

    it("should not rate limit for first email", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const setTimeoutSpy = jest.spyOn(global, "setTimeout");

      const request = mockRequest({ authorization: "Bearer valid" });
      await GET(request);

      // Check that setTimeout was called fewer times than candidates
      // (rate limiting only happens AFTER first send)
      const rateLimitCalls = setTimeoutSpy.mock.calls.filter(
        (call) => call[1] === 600
      );
      expect(rateLimitCalls.length).toBe(0);

      setTimeoutSpy.mockRestore();
    });
  });

  describe("Recent Intel Fetching", () => {
    it("should fetch recent intel posts for beach", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      const request = mockRequest({ authorization: "Bearer valid" });
      await GET(request);

      expect(mockFrom).toHaveBeenCalledWith("intel_posts");
      expect(mockSelect).toHaveBeenCalledWith("tag, description");
      expect(mockEq).toHaveBeenCalledWith("beach_id", "beach-1");
      expect(mockEq).toHaveBeenCalledWith("is_active", true);
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(2);
    });

    it("should handle intel fetch errors gracefully", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      mockLimit.mockResolvedValueOnce({
        data: null,
        error: { message: "Intel fetch error" },
      });

      const request = mockRequest({ authorization: "Bearer valid" });
      const response = await GET(request);
      const data = await response.json();

      // Should still succeed, just with empty intel array
      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(1);
    });
  });

  describe("Time Formatting", () => {
    it("should format best window times correctly", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: "08:30:00",
          best_window_end: "14:45:00",
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const { ReengagementEmail } = require("@/lib/mailer/templates/ReengagementEmail");

      const request = mockRequest({ authorization: "Bearer valid" });
      await GET(request);

      expect(ReengagementEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          bestWindow: {
            start: "8:30 AM",
            end: "2:45 PM",
          },
        })
      );
    });

    it("should handle null best window", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const { ReengagementEmail } = require("@/lib/mailer/templates/ReengagementEmail");

      const request = mockRequest({ authorization: "Bearer valid" });
      await GET(request);

      expect(ReengagementEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          bestWindow: null,
        })
      );
    });
  });

  describe("Summary Statistics", () => {
    it("should return correct summary statistics", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 9,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
        {
          user_id: "user-2",
          email: "user2@example.com",
          display_name: "User Two",
          home_beach_id: "beach-2",
          beach_name: "Test Beach 2",
          beach_slug: "test-beach-2",
          conditions_score: 8,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
        {
          user_id: "user-3",
          email: "user3@example.com",
          display_name: "User Three",
          home_beach_id: "beach-3",
          beach_name: "Test Beach 3",
          beach_slug: "test-beach-3",
          conditions_score: 7,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null }) // user-1 claimed
        .mockResolvedValueOnce({ data: false, error: null }) // user-2 claim failed
        .mockResolvedValueOnce({ data: true, error: null }); // user-3 claimed

      mockLimit
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      // user-3 send fails
      mockEmailsSend
        .mockResolvedValueOnce({ id: "email-1" })
        .mockRejectedValueOnce(new Error("Send failed"));

      const request = mockRequest({ authorization: "Bearer valid" });
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary).toEqual({
        candidates: 3,
        sent: 1,
        durationMs: expect.any(Number),
        skipped: {
          claimFailed: 1,
          sendFailed: 1,
        },
      });
    });

    it("should include duration in summary", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const request = mockRequest({ authorization: "Bearer valid" });
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.summary.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof data.data.summary.durationMs).toBe("number");
    });
  });
});
