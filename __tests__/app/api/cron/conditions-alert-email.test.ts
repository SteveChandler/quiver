/**
 * Unit tests for Conditions Alert Email Cron Job API
 * Tests the cron endpoint that sends daily alerts when conditions are excellent
 *
 * Test coverage:
 * - Authentication and authorization
 * - Candidate fetching and processing
 * - Email sending with rate limiting
 * - Slot claim deduplication
 * - Error handling and graceful degradation
 * - Summary statistics
 */

import { GET } from "@/app/api/cron/conditions-alert-email/route";
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

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
    })
  ),
}));

// Mock Resend mailer - use module-scoped mock (Jest hoists `mock`-prefixed vars)
// Note: send is wrapped in a closure because jest.mock factories execute before
// const declarations, but the closure defers access until call time.
const mockEmailsSend = jest.fn();
jest.mock("@/lib/mailer/client", () => ({
  resend: {
    emails: {
      send: (...args: any[]) => mockEmailsSend(...args),
    },
  },
  MAIL_FROM: "Quiver <test@quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <test@quiversurf.app>",
  getBaseUrl: () => "https://quiversurf.app",
}));

// Mock email template
jest.mock("@/lib/mailer/templates/ConditionsAlertEmail", () => ({
  ConditionsAlertEmail: jest.fn(() => "ConditionsAlertEmail"),
}));

// Mock email formatters
jest.mock("@/lib/email/email-formatters", () => ({
  formatDatabaseTime: jest.fn((time: string) => {
    if (!time) return null;
    const parts = time.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours > 12 ? hours - 12 : hours || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }),
  getConditionLabel: jest.fn((score: number) => {
    if (score >= 85) return { label: "Perfect", color: "#10b981", emoji: "🔥" };
    if (score >= 70) return { label: "Excellent", color: "#3b82f6", emoji: "✨" };
    return { label: "Good", color: "#22c55e", emoji: "🌊" };
  }),
}));

// Mock scoring engine — re-scoring falls back gracefully when supabase.from
// is not available, so the engine should rarely be hit; this keeps the test
// from instantiating the real plugin chain when it is. Only the symbols the
// route actually imports are provided to avoid a circular requireActual eval.
jest.mock("@/lib/domains/scoring", () => ({
  createDiscoveryScoringEngine: jest.fn(() => ({
    score: jest.fn(() => ({
      total: 0,
      subscores: new Map(),
      matchQuality: "skip",
      reasons: [],
      warnings: [],
      skipReason: null,
      confidence: 0,
    })),
  })),
  beachToSpotProfile: jest.fn(() => ({})),
  forecastToSnapshot: jest.fn(() => ({})),
}));

// Mock email logging service
jest.mock("@/lib/services/email-logging-service", () => ({
  createEmailLogger: jest.fn(() => ({
    logDelivery: jest.fn().mockResolvedValue(undefined),
    logEmailSent: jest.fn(),
    logEmailFailed: jest.fn(),
  })),
}));

// Mock rate limiter
const mockThrottle = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: jest.fn(() => ({
    throttle: mockThrottle,
    waitForSlot: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe("Conditions Alert Email Cron Job API", () => {
  const mockRequest = (
    headers: Record<string, string> = {},
    url = "http://localhost/api/cron/conditions-alert-email"
  ) => {
    return {
      url,
      headers: {
        get: jest.fn((name: string) => headers[name] || null),
      },
      json: jest.fn(() => Promise.resolve({})),
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default RPC responses
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    // Default Resend response
    mockEmailsSend.mockResolvedValue({
      data: { id: "mock-resend-id" },
      error: null,
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

      expect(mockRpc).toHaveBeenCalledWith("get_conditions_alert_candidates", {
        p_min_score: 70,
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
      expect(data.error).toContain("Failed to fetch conditions alert candidates");
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
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: "08:00:00",
          best_window_end: "10:00:00",
        },
        {
          user_id: "user-2",
          email: "user2@example.com",
          display_name: "User Two",
          home_beach_id: "beach-2",
          beach_name: "Test Beach 2",
          beach_slug: "test-beach-2",
          conditions_score: 80,
          surf_description: "Solid 2-3ft",
          wind_description: "Calm",
          best_window_start: null,
          best_window_end: null,
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
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
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
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
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
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
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
        p_alert_type: "conditions_alert",
        p_dedupe_hours: 20,
      });
    });
  });

  describe("Email Sending", () => {
    it("should send email with correct parameters including emoji subject", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "John Doe",
          home_beach_id: "beach-1",
          beach_name: "Ocean Beach",
          beach_slug: "ocean-beach",
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: "08:00:00",
          best_window_end: "10:00:00",
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

      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: "Quiver <test@quiversurf.app>",
        replyTo: "Quiver <test@quiversurf.app>",
        to: "user1@example.com",
        subject: "🔥 Ocean Beach: 90 today",
        react: "ConditionsAlertEmail", // Mocked component
      });
    });

    it.each([
      { score: 90, expectedEmoji: "🔥", expectedSubject: "🔥 Test Beach: 90 today" },
      { score: 80, expectedEmoji: "✨", expectedSubject: "✨ Test Beach: 80 today" },
      { score: 65, expectedEmoji: "🌊", expectedSubject: "🌊 Test Beach: 65 today" },
    ])("should use emoji $expectedEmoji in subject for score $score", async ({ score, expectedSubject }) => {
      jest.clearAllMocks();

      const candidates = [
        {
          user_id: "user-1",
          email: "test@example.com",
          display_name: "Test",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: score,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      const request = mockRequest({ authorization: "Bearer valid" });
      await GET(request);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expectedSubject,
        })
      );
    });

    it("should include correct template props", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "John Doe",
          home_beach_id: "beach-1",
          beach_name: "Ocean Beach",
          beach_slug: "ocean-beach",
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: "08:00:00",
          best_window_end: "10:00:00",
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null });

      const { ConditionsAlertEmail } = require("@/lib/mailer/templates/ConditionsAlertEmail");

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      await GET(request);

      expect(ConditionsAlertEmail).toHaveBeenCalledWith({
        displayName: "John Doe",
        beachName: "Ocean Beach",
        conditionsScore: 90,
        surfDescription: "Clean 3-4ft",
        windDescription: "Light offshore",
        bestWindow: {
          start: "8:00 AM",
          end: "10:00 AM",
        },
        ctaUrl: "https://quiversurf.app/beach/ocean-beach",
        logSessionUrl: "https://quiversurf.app/sessions/new?mode=log&beach=beach-1",
        unsubscribeUrl: "https://quiversurf.app/settings",
      });
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
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null });

      const { ConditionsAlertEmail } = require("@/lib/mailer/templates/ConditionsAlertEmail");

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      await GET(request);

      expect(ConditionsAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          bestWindow: null,
        })
      );
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
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null }); // claim slot

      mockEmailsSend.mockResolvedValueOnce({
        data: null,
        error: new Error("Resend API error"),
      });

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
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
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
          conditions_score: 90,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
        },
        {
          user_id: "user-2",
          email: "user2@example.com",
          display_name: "User Two",
          home_beach_id: "beach-2",
          beach_name: "Test Beach 2",
          beach_slug: "test-beach-2",
          conditions_score: 80,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null }) // claim 1
        .mockResolvedValueOnce({ data: true, error: null }); // claim 2

      mockThrottle.mockClear();

      const request = mockRequest({ authorization: "Bearer valid" });
      await GET(request);

      // Should have called throttle for rate limiting (once per candidate)
      expect(mockThrottle).toHaveBeenCalledTimes(2);
    });
  });

  describe("Email Logging", () => {
    it("should log email delivery with correct parameters", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      const { createEmailLogger } = require("@/lib/services/email-logging-service");
      const mockLogDelivery = jest.fn().mockResolvedValue(undefined);
      createEmailLogger.mockReturnValueOnce({
        logDelivery: mockLogDelivery,
        logEmailSent: jest.fn(),
        logEmailFailed: jest.fn(),
      });

      const request = mockRequest({ authorization: "Bearer valid" });
      await GET(request);

      expect(mockLogDelivery).toHaveBeenCalledWith({
        userId: "user-1",
        emailType: "conditions_alert",
        subject: "🔥 Test Beach: 90 today",
        bestScore: 90,
        bestBeachId: "beach-1",
        resendMessageId: "mock-resend-id",
        meta: {
          beach_name: "Test Beach",
          beach_slug: "test-beach",
        },
      });
    });
  });

  describe("Summary Statistics", () => {
    it("should return correct summary statistics with mixed outcomes", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          conditions_score: 90,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
        },
        {
          user_id: "user-2",
          email: "user2@example.com",
          display_name: "User Two",
          home_beach_id: "beach-2",
          beach_name: "Test Beach 2",
          beach_slug: "test-beach-2",
          conditions_score: 80,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
        },
        {
          user_id: "user-3",
          email: "user3@example.com",
          display_name: "User Three",
          home_beach_id: "beach-3",
          beach_name: "Test Beach 3",
          beach_slug: "test-beach-3",
          conditions_score: 70,
          surf_description: "Test",
          wind_description: "Test",
          best_window_start: null,
          best_window_end: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null }) // user-1 claimed
        .mockResolvedValueOnce({ data: false, error: null }) // user-2 claim failed
        .mockResolvedValueOnce({ data: true, error: null }); // user-3 claimed

      // user-3 send fails
      mockEmailsSend
        .mockResolvedValueOnce({ data: { id: "mock-resend-id" }, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error("Send failed") });

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
