/**
 * @jest-environment node
 *
 * Tests for POST /api/internal/send-welcome-email
 *
 * Validates:
 * - Authentication (requires valid user session)
 * - Rate limiting
 * - Deduplication via email_send_log
 * - Successful email sending
 * - Error handling (database errors, email failures)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

// ============================================================================
// Module Mocks
// ============================================================================

// Mock authenticated user
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  created_at: new Date().toISOString(),
};

// Mock Supabase server client (for auth)
const mockGetUser = jest.fn();
const mockSupabaseServerClient = {
  auth: {
    getUser: mockGetUser,
  },
};

// Mock Supabase service role client (for database)
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockLimit = jest.fn();
const mockMaybeSingle = jest.fn();
const mockInsert = jest.fn();

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}));

mockSelect.mockReturnValue({
  eq: mockEq,
});

// Added plan abstract-exploring-phoenix (Commit C): the route now also
// does a direct .from(profiles).select().eq().maybeSingle() lookup to
// fetch home_beach_id (no .limit() in that chain). Return `maybeSingle`
// at the `.eq()` terminal so both the email_send_log existing-check
// chain and the new profile fetch succeed without the tests having to
// model the full query surface.
mockEq.mockImplementation(() => ({
  eq: mockEq,
  limit: mockLimit,
  maybeSingle: mockMaybeSingle,
}));

mockLimit.mockReturnValue({
  maybeSingle: mockMaybeSingle,
});

const mockSupabaseServiceRoleClient = {
  from: mockFrom,
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseServerClient),
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabaseServiceRoleClient),
}));

// Mock the Resend email client
const mockEmailSend = jest.fn();
jest.mock("@/lib/mailer/client", () => ({
  resend: {
    emails: {
      send: jest.fn((...args) => mockEmailSend(...args)),
    },
  },
  MAIL_FROM: "Quiver <test@quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <test@quiversurf.app>",
  getBaseUrl: jest.fn(() => "https://quiversurf.app"),
}));

// Mock the welcome email template generator
const mockGenerateWelcomeEmail = jest.fn();
jest.mock("@/lib/email/templates/welcome-email", () => ({
  generateWelcomeEmail: jest.fn((...args) => mockGenerateWelcomeEmail(...args)),
}));

// Mock the email token secret
jest.mock("@/lib/utils/email-token", () => ({
  getEmailTokenSecret: jest.fn(() => "test-secret-key"),
}));

// Mock rate limiter to allow requests in tests
jest.mock("@/lib/utils/enhanced-rate-limiter", () => ({
  getCachedRateLimiter: jest.fn(() => ({
    canMakeRequest: jest.fn(() => true),
    recordRequest: jest.fn(),
    getStatus: jest.fn(() => ({ requestsRemaining: 100, timeUntilReset: 60000 })),
    getRetryAfter: jest.fn(() => 60),
  })),
}));

// Import route handler after mocks are set up
import { POST } from "@/app/api/internal/send-welcome-email/route";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRequest(): NextRequest {
  return new NextRequest("https://quiversurf.app/api/internal/send-welcome-email", {
    method: "POST",
    headers: {
      "x-forwarded-for": "127.0.0.1",
    },
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe("POST /api/internal/send-welcome-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Default: no existing welcome email
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Default: successful email generation
    mockGenerateWelcomeEmail.mockResolvedValue({
      subject: "You're in",
      html: "<html>Welcome</html>",
      text: "Welcome to Quiver!",
    });

    // Default: successful email send
    mockEmailSend.mockResolvedValue({ data: { id: "email-123" }, error: null });

    // Default: successful log insert
    mockInsert.mockResolvedValue({ error: null });
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/internal/send-welcome-email/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(typeof data.error).toBe("string");
    });

    it("returns 401 when auth check fails", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Auth service unavailable" },
      });

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("succeeds with valid authenticated user", async () => {
      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.sent).toBe(true);
    });
  });

  // ==========================================================================
  // Deduplication Tests
  // ==========================================================================

  describe("Deduplication", () => {
    it("returns already_sent when email was previously sent", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: "existing-log-id" },
        error: null,
      });

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.sent).toBe(false);
      expect(data.data.reason).toBe("already_sent");
      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it("fails closed when database check fails", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Email Sending Tests
  // ==========================================================================

  describe("Email Sending", () => {
    it("sends welcome email to authenticated user", async () => {
      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: "You're in",
        })
      );
      expect(mockGenerateWelcomeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: "https://quiversurf.app",
          homeBeachName: null,
          homeBeachSlug: null,
          messageInstanceId: expect.any(String),
        }),
        "test-secret-key"
      );
    });

    it("passes home beach slug and message id to the welcome template", async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { home_beach_id: "beach-123" }, error: null })
        .mockResolvedValueOnce({ data: { name: "Blacks", slug: "blacks" }, error: null });

      const request = createMockRequest();
      await POST(request);

      expect(mockGenerateWelcomeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          homeBeachName: "Blacks",
          homeBeachSlug: "blacks",
          messageInstanceId: expect.any(String),
        }),
        "test-secret-key"
      );
    });

    it("returns 400 when user has no email", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { ...mockUser, email: null } },
        error: null,
      });

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(typeof data.error).toBe("string");
    });

    it("returns 500 when email send fails", async () => {
      mockEmailSend.mockResolvedValue({
        data: null,
        error: { message: "Resend API error" },
      });

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it("logs delivery after successful send", async () => {
      const request = createMockRequest();
      await POST(request);

      expect(mockFrom).toHaveBeenCalledWith("email_send_log");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          email_type: "welcome",
          subject: "You're in",
          meta: {
            trigger: "immediate_signup",
            message_instance_id: expect.any(String),
          },
        })
      );
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe("Error Handling", () => {
    it("handles email template generation failure", async () => {
      mockGenerateWelcomeEmail.mockRejectedValue(
        new Error("Template generation failed")
      );

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it("handles log insert failure gracefully (email still sent)", async () => {
      mockInsert.mockResolvedValue({
        error: { message: "Insert failed" },
      });

      const request = createMockRequest();
      const response = await POST(request);

      // Email was sent, so response should be success
      // (log failure is non-blocking)
      expect(response.status).toBe(200);
      expect(mockEmailSend).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Response Format Tests
  // ==========================================================================

  describe("Response Format", () => {
    it("returns correct format on success", async () => {
      const request = createMockRequest();
      const response = await POST(request);

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        data: { sent: true },
      });
    });

    it("returns correct format on already_sent", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: "existing" },
        error: null,
      });

      const request = createMockRequest();
      const response = await POST(request);

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        data: { sent: false, reason: "already_sent" },
      });
    });
  });
});
