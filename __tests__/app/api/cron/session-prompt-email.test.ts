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
import { readFileSync } from "fs";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));
const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) =>
  beaches.filter((beach) => beach.id !== "held-beach"),
);

// Mock API response utilities
jest.mock("@/lib/middleware/api-wrappers", () => ({
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

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
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

jest.mock("@/lib/email/suppression", () => ({
  filterSuppressedRecipients: jest.fn(
    async (_supabase: unknown, candidates: unknown[]) => candidates,
  ),
}));

// Mock rate limiter
const mockThrottle = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: jest.fn(() => ({
    throttle: mockThrottle,
    waitForSlot: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock email token utilities so cron tests don't need a real EMAIL_TOKEN_SECRET
jest.mock("@/lib/utils/email-token", () => ({
  signEmailToken: jest.fn().mockResolvedValue("mock-signed-token"),
  getEmailTokenSecret: jest.fn().mockReturnValue("mock-secret"),
}));

describe("Session Prompt Email Cron Job API", () => {
  const routeSource = readFileSync(
    "app/api/cron/session-prompt-email/route.ts",
    "utf8"
  );
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

  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(true);

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

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  describe("Authentication", () => {
    it("should reject requests without valid cron authentication", async () => {
      const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
      validateCronRequest.mockReturnValue(false);

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

    it("should accept Bearer cron token", async () => {
      const request = mockRequest({
        authorization: "Bearer test-cron-secret",
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
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
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

    it("does not send a session-prompt email naming a held home beach", async () => {
      const candidates = [
        {
          user_id: "user-held",
          email: "held@example.com",
          display_name: "Held User",
          home_beach_id: "held-beach",
          beach_name: "Held Beach",
          beach_slug: "held-beach",
          conditions_score: 90,
          surf_description: "Clean 3-4ft",
        },
        {
          user_id: "user-safe",
          email: "safe@example.com",
          display_name: "Safe User",
          home_beach_id: "safe-beach",
          beach_name: "Safe Beach",
          beach_slug: "safe-beach",
          conditions_score: 80,
          surf_description: "Solid 2-3ft",
        },
      ];
      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      const response = await GET(mockRequest({ authorization: "Bearer valid-cron-secret" }));
      const data = await response.json();

      expect(data.data.summary.candidates).toBe(1);
      expect(data.data.summary.sent).toBe(1);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(mockEmailsSend.mock.calls[0][0].to).toBe("safe@example.com");
      expect(mockEmailsSend.mock.calls[0][0].subject).toContain("Safe Beach");
      expect(mockEmailsSend.mock.calls[0][0].subject).not.toContain("Held Beach");
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
          conditions_score: 90,
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

    it("should include app-first session links with email attribution", async () => {
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
      expect(callArgs.displayName).toBe("John Doe");
      expect(callArgs.beachName).toBe("Ocean Beach");
      expect(callArgs.conditionsScore).toBe(90);
      expect(callArgs.surfDescription).toBe("Clean 3-4ft");
      expect(callArgs.unsubscribeUrl).toBe("https://quiversurf.app/settings");
      expect(callArgs.appSessionUrl).toBe(callArgs.confirmUrl);
      expect(callArgs.confirmUrl).toBe(callArgs.skipUrl);
      const ctaUrl = new URL(callArgs.appSessionUrl);
      expect(ctaUrl.origin).toBe("https://www.quiversurf.app");
      expect(ctaUrl.pathname).toBe("/sessions/new");
      expect(ctaUrl.searchParams.get("token")).toBe("mock-signed-token");
      expect(ctaUrl.searchParams.get("beachId")).toBe("beach-1");
      expect(ctaUrl.searchParams.get("beachName")).toBe("Ocean Beach");
      expect(ctaUrl.searchParams.get("startedAt")).toMatch(
        /^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/
      );
      expect(ctaUrl.searchParams.get("entrySource")).toBe("email");
      expect(ctaUrl.searchParams.get("beach_id")).toBeNull();
      expect(ctaUrl.searchParams.get("window")).toBeNull();
      expect(ctaUrl.searchParams.get("utm_source")).toBe("email");
      expect(ctaUrl.searchParams.get("utm_medium")).toBe("email");
      expect(ctaUrl.searchParams.get("utm_campaign")).toBe("session_prompt");
      expect(ctaUrl.searchParams.get("email_type")).toBe("session_prompt");
      expect(ctaUrl.searchParams.get("source")).toBe("session_prompt_email");
      expect(ctaUrl.searchParams.get("message_instance_id")).toEqual(
        expect.any(String)
      );
      expect(callArgs.confirmUrl).not.toContain("/session/confirm");
      expect(callArgs.skipUrl).not.toContain("/session/skip");
    });

    it("should not include logSessionUrl in template props", async () => {
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
      expect(callArgs.logSessionUrl).toBeUndefined();
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
          conditions_score: 90,
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
        bestScore: 90,
        bestBeachId: "beach-1",
        resendMessageId: "mock-resend-id",
        meta: {
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          message_instance_id: expect.any(String),
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
