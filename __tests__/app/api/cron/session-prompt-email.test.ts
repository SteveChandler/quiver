/**
 * Unit tests for Session Prompt Email Cron Job API
 * Tests the cron endpoint that prompts users to log sessions after good conditions
 *
 * Test coverage:
 * - Authentication and authorization
 * - Candidate fetching and processing
 * - Email sending with rate limiting
 * - Slot claim deduplication
 * - Error handling and graceful degradation
 * - Summary statistics
 */

import { GET } from "@/app/api/cron/session-prompt-email/route";
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
jest.mock("@/lib/mailer/templates/SessionPromptEmail", () => ({
  SessionPromptEmail: jest.fn(() => "SessionPromptEmail"),
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

describe("Session Prompt Email Cron Job API", () => {
  const mockRequest = (
    headers: Record<string, string> = {},
    url = "http://localhost/api/cron/session-prompt-email"
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

      expect(mockRpc).toHaveBeenCalledWith("get_session_prompt_candidates", {
        p_min_score: 7,
        p_cooldown_hours: 20,
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
      expect(data.error).toContain("Failed to fetch session prompt candidates");
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
        p_alert_type: "session_prompt",
        p_dedupe_hours: 20,
      });
    });
  });

  describe("Email Sending", () => {
    it("should send email with correct subject format", async () => {
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
        subject: "How was your session at Ocean Beach?",
        react: "SessionPromptEmail", // Mocked component
      });
    });

    it("should include correct template props without bestWindow", async () => {
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
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null });

      const { SessionPromptEmail } = require("@/lib/mailer/templates/SessionPromptEmail");

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      await GET(request);

      expect(SessionPromptEmail).toHaveBeenCalledWith({
        displayName: "John Doe",
        beachName: "Ocean Beach",
        conditionsScore: 9,
        surfDescription: "Clean 3-4ft",
        logSessionUrl: "https://quiversurf.app/sessions/new?mode=log&beach=beach-1",
        unsubscribeUrl: "https://quiversurf.app/settings",
      });
    });

    it("should not include ctaUrl in template props", async () => {
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
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null });

      const { SessionPromptEmail } = require("@/lib/mailer/templates/SessionPromptEmail");

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      await GET(request);

      const callArgs = SessionPromptEmail.mock.calls[0][0];
      expect(callArgs.ctaUrl).toBeUndefined();
      expect(callArgs.bestWindow).toBeUndefined();
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
        },
      ];

      mockRpc
        .mockResolvedValueOnce({
          data: candidates,
          error: null,
        })
        .mockResolvedValueOnce({ data: true, error: null }); // claim slot

      mockEmailsSend.mockResolvedValueOnce({
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
          conditions_score: 9,
          surf_description: "Clean 3-4ft",
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
          conditions_score: 9,
          surf_description: "Clean 3-4ft",
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
        emailType: "session_prompt",
        subject: "How was your session at Test Beach?",
        bestScore: 9,
        bestBeachId: "beach-1",
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
          conditions_score: 9,
          surf_description: "Test",
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
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null }) // user-1 claimed
        .mockResolvedValueOnce({ data: false, error: null }) // user-2 claim failed
        .mockResolvedValueOnce({ data: true, error: null }); // user-3 claimed

      // user-3 send fails
      mockEmailsSend
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: new Error("Send failed") });

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
