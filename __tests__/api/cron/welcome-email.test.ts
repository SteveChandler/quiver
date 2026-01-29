/**
 * @jest-environment node
 *
 * Tests for GET /api/cron/welcome-email
 *
 * Validates:
 * - Cron authentication (Vercel header, Bearer token)
 * - Sending welcome emails to unconfirmed users after 24h
 * - Sending welcome emails to users without home beach after 48h
 * - Auto-confirmation of unconfirmed users
 * - Deduplication via email_send_log
 * - Graceful handling of Resend API failures
 * - Idempotency (safe to retry)
 */

import {
  setupCronTestEnvironment,
  createMockCronRequest,
  createMockEmailCandidate,
  verifyIdempotency,
  expectCronSuccess,
  expectCronError,
  type CronTestEnvironment,
} from "@/__tests__/setup/cron-test-utils";

// ============================================================================
// Module Mocks
// ============================================================================

// Mock the Supabase service role client
const mockInsert = jest.fn();
const mockFrom = jest.fn(() => ({
  insert: mockInsert,
}));

const mockUpdateUserById = jest.fn();
const mockRpc = jest.fn();

const mockSupabaseClient = {
  rpc: mockRpc,
  from: mockFrom,
  auth: {
    admin: {
      updateUserById: mockUpdateUserById,
    },
  },
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabaseClient),
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

// Import route handler after mocks are set up
import { GET } from "@/app/api/cron/welcome-email/route";

// ============================================================================
// Test Suite
// ============================================================================

describe("Cron: welcome-email", () => {
  let cronEnv: CronTestEnvironment;

  beforeEach(() => {
    cronEnv = setupCronTestEnvironment({
      additionalEnvVars: {
        NEXT_PUBLIC_APP_URL: "https://quiversurf.app",
        RESEND_API_KEY: "test-resend-key",
      },
    });
    jest.clearAllMocks();

    // Default mock implementations
    mockGenerateWelcomeEmail.mockResolvedValue({
      subject: "Welcome to Quiver!",
      html: "<html>Welcome</html>",
      text: "Welcome to Quiver!",
    });

    mockEmailSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockUpdateUserById.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    cronEnv.cleanup();
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  describe("Authentication", () => {
    it("requires valid cron authentication", async () => {
      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(data.data.summary).toBeDefined();
    });

    it("accepts Bearer token authentication", async () => {
      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "bearer-token",
        cronSecret: "test-cron-secret",
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("accepts Vercel user-agent authentication", async () => {
      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-ua",
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("rejects invalid credentials", async () => {
      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "none",
      });

      const response = await GET(request);

      await expectCronError(response, 401, "Unauthorized");
    });

    it("rejects incorrect Bearer token", async () => {
      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "bearer-token",
        cronSecret: "wrong-secret",
      });

      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  // ==========================================================================
  // Email Sending Tests
  // ==========================================================================

  describe("Email Sending", () => {
    it("sends welcome emails to unconfirmed users after 24h", async () => {
      const candidate = createMockEmailCandidate({
        user_id: "user-unconfirmed-24h",
        email: "unconfirmed@example.com",
        email_confirmed_at: null,
        home_beach_id: null,
      });
      // Add the case_type required by the route
      const candidateWithCase = {
        ...candidate,
        case_type: "unconfirmed_24h" as const,
      };

      mockRpc.mockResolvedValue({
        data: [candidateWithCase],
        error: null,
      });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(data.data.summary.candidates).toBe(1);
      expect(data.data.summary.sent).toBe(1);
      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "unconfirmed@example.com",
          subject: "Welcome to Quiver!",
        })
      );
    });

    it("sends welcome emails to users without home beach after 48h", async () => {
      const candidate = createMockEmailCandidate({
        user_id: "user-no-home-beach",
        email: "nobeach@example.com",
        email_confirmed_at: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
        home_beach_id: null,
      });
      const candidateWithCase = {
        ...candidate,
        case_type: "no_home_beach_48h" as const,
      };

      mockRpc.mockResolvedValue({
        data: [candidateWithCase],
        error: null,
      });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(data.data.summary.candidates).toBe(1);
      expect(data.data.summary.sent).toBe(1);
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "nobeach@example.com",
        })
      );
    });

    it("processes multiple candidates of different types", async () => {
      const candidates = [
        {
          ...createMockEmailCandidate({
            user_id: "user-1",
            email: "user1@example.com",
            email_confirmed_at: null,
          }),
          case_type: "unconfirmed_24h" as const,
        },
        {
          ...createMockEmailCandidate({
            user_id: "user-2",
            email: "user2@example.com",
            email_confirmed_at: new Date().toISOString(),
            home_beach_id: null,
          }),
          case_type: "no_home_beach_48h" as const,
        },
      ];

      mockRpc.mockResolvedValue({ data: candidates, error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(data.data.summary.candidates).toBe(2);
      expect(data.data.summary.sent).toBe(2);
      expect(mockEmailSend).toHaveBeenCalledTimes(2);
    });

    it("returns early when no candidates found", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(data.data.summary.candidates).toBe(0);
      expect(data.data.summary.sent).toBe(0);
      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Auto-Confirmation Tests
  // ==========================================================================

  describe("Auto-Confirmation", () => {
    it("auto-confirms unconfirmed users on send", async () => {
      const candidate = {
        ...createMockEmailCandidate({
          user_id: "user-to-confirm",
          email: "toconfirm@example.com",
          email_confirmed_at: null,
        }),
        case_type: "unconfirmed_24h" as const,
      };

      mockRpc.mockResolvedValue({ data: [candidate], error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(data.data.summary.autoConfirmed).toBe(1);
      expect(mockUpdateUserById).toHaveBeenCalledWith("user-to-confirm", {
        email_confirm: true,
      });
    });

    it("does not auto-confirm users with no_home_beach_48h case", async () => {
      const candidate = {
        ...createMockEmailCandidate({
          user_id: "user-already-confirmed",
          email: "confirmed@example.com",
          email_confirmed_at: new Date().toISOString(),
          home_beach_id: null,
        }),
        case_type: "no_home_beach_48h" as const,
      };

      mockRpc.mockResolvedValue({ data: [candidate], error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(data.data.summary.autoConfirmed).toBe(0);
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("handles auto-confirm failures gracefully", async () => {
      const candidate = {
        ...createMockEmailCandidate({
          user_id: "user-confirm-fail",
          email: "confirmfail@example.com",
          email_confirmed_at: null,
        }),
        case_type: "unconfirmed_24h" as const,
      };

      mockRpc.mockResolvedValue({ data: [candidate], error: null });
      mockUpdateUserById.mockResolvedValue({
        error: { message: "Auth service unavailable" },
      });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      // Email was still sent, but confirm failed
      expect(data.data.summary.sent).toBe(1);
      expect(data.data.summary.autoConfirmed).toBe(0);
      expect(data.data.summary.skipped.confirmFailed).toBe(1);
    });
  });

  // ==========================================================================
  // Deduplication Tests
  // ==========================================================================

  describe("Deduplication", () => {
    it("logs sent emails for deduplication", async () => {
      const candidate = {
        ...createMockEmailCandidate({
          user_id: "user-to-log",
          email: "log@example.com",
        }),
        case_type: "unconfirmed_24h" as const,
      };

      mockRpc.mockResolvedValue({ data: [candidate], error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      await GET(request);

      expect(mockFrom).toHaveBeenCalledWith("email_send_log");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-to-log",
          email_type: "welcome",
          subject: "Welcome to Quiver!",
          meta: { case_type: "unconfirmed_24h" },
        })
      );
    });

    it("handles log insert failures gracefully", async () => {
      const candidate = {
        ...createMockEmailCandidate({
          user_id: "user-log-fail",
          email: "logfail@example.com",
        }),
        case_type: "unconfirmed_24h" as const,
      };

      mockRpc.mockResolvedValue({ data: [candidate], error: null });
      mockInsert.mockResolvedValue({
        error: { message: "Database constraint violation" },
      });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      // Email was still sent successfully
      expect(data.data.summary.sent).toBe(1);
      expect(data.data.summary.skipped.logFailed).toBe(1);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe("Error Handling", () => {
    it("handles Resend API failures gracefully", async () => {
      const candidates = [
        {
          ...createMockEmailCandidate({
            user_id: "user-email-fail",
            email: "fail@example.com",
          }),
          case_type: "unconfirmed_24h" as const,
        },
        {
          ...createMockEmailCandidate({
            user_id: "user-email-success",
            email: "success@example.com",
          }),
          case_type: "unconfirmed_24h" as const,
        },
      ];

      mockRpc.mockResolvedValue({ data: candidates, error: null });

      // First call fails, second succeeds
      mockEmailSend
        .mockResolvedValueOnce({ error: { message: "Resend API error" } })
        .mockResolvedValueOnce({ data: { id: "email-456" }, error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(data.data.summary.candidates).toBe(2);
      expect(data.data.summary.sent).toBe(1);
      expect(data.data.summary.skipped.sendFailed).toBe(1);
    });

    it("handles RPC failures with error response", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC function not found" },
      });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("RPC get_welcome_email_candidates failed");
    });

    it("handles email template generation failures", async () => {
      const candidate = {
        ...createMockEmailCandidate({
          user_id: "user-template-fail",
          email: "templatefail@example.com",
        }),
        case_type: "unconfirmed_24h" as const,
      };

      mockRpc.mockResolvedValue({ data: [candidate], error: null });
      mockGenerateWelcomeEmail.mockRejectedValue(
        new Error("Template generation failed")
      );

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      // Should count as sendFailed since the error is caught per-user
      expect(data.data.summary.skipped.sendFailed).toBe(1);
      expect(data.data.summary.sent).toBe(0);
    });

    it("continues processing after individual user failures", async () => {
      const candidates = [
        {
          ...createMockEmailCandidate({
            user_id: "user-1",
            email: "user1@example.com",
          }),
          case_type: "unconfirmed_24h" as const,
        },
        {
          ...createMockEmailCandidate({
            user_id: "user-2",
            email: "user2@example.com",
          }),
          case_type: "unconfirmed_24h" as const,
        },
        {
          ...createMockEmailCandidate({
            user_id: "user-3",
            email: "user3@example.com",
          }),
          case_type: "unconfirmed_24h" as const,
        },
      ];

      mockRpc.mockResolvedValue({ data: candidates, error: null });

      // First fails, second and third succeed
      mockEmailSend
        .mockResolvedValueOnce({ error: { message: "Rate limited" } })
        .mockResolvedValueOnce({ data: { id: "email-2" }, error: null })
        .mockResolvedValueOnce({ data: { id: "email-3" }, error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(data.data.summary.candidates).toBe(3);
      expect(data.data.summary.sent).toBe(2);
      expect(data.data.summary.skipped.sendFailed).toBe(1);
    });
  });

  // ==========================================================================
  // Idempotency Tests
  // ==========================================================================

  describe("Idempotency", () => {
    it("is idempotent (safe to retry)", async () => {
      // First run: candidates exist
      mockRpc.mockResolvedValue({ data: [], error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const result = await verifyIdempotency(GET, request, {
        ignoreFields: ["timestamp", "durationMs"],
      });

      expect(result.isIdempotent).toBe(true);
    });

    it("returns consistent summary structure on repeated calls", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const request1 = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });
      const request2 = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response1 = await GET(request1);
      const response2 = await GET(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      // Both should have the same structure
      expect(data1.data.summary).toHaveProperty("candidates");
      expect(data1.data.summary).toHaveProperty("sent");
      expect(data1.data.summary).toHaveProperty("autoConfirmed");
      expect(data1.data.summary).toHaveProperty("skipped");

      expect(data2.data.summary).toHaveProperty("candidates");
      expect(data2.data.summary).toHaveProperty("sent");
      expect(data2.data.summary).toHaveProperty("autoConfirmed");
      expect(data2.data.summary).toHaveProperty("skipped");
    });

    it("does not re-send to same users on retry (RPC handles dedup)", async () => {
      // The RPC function get_welcome_email_candidates already excludes
      // users who have received a welcome email (via email_send_log join).
      // This test verifies the cron correctly relies on the RPC for dedup.

      const candidate = {
        ...createMockEmailCandidate({
          user_id: "user-once",
          email: "once@example.com",
        }),
        case_type: "unconfirmed_24h" as const,
      };

      // First call: RPC returns the candidate
      mockRpc.mockResolvedValueOnce({ data: [candidate], error: null });
      // Second call: RPC returns empty (user already in email_send_log)
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const request1 = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });
      const request2 = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response1 = await GET(request1);
      const response2 = await GET(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.data.summary.sent).toBe(1);
      expect(data2.data.summary.sent).toBe(0);
      expect(mockEmailSend).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Summary Response Tests
  // ==========================================================================

  describe("Summary Response", () => {
    it("includes all required summary fields", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      const { summary } = data.data;
      expect(summary).toHaveProperty("candidates");
      expect(summary).toHaveProperty("sent");
      expect(summary).toHaveProperty("autoConfirmed");
      expect(summary).toHaveProperty("durationMs");
      expect(summary).toHaveProperty("skipped");
      expect(summary.skipped).toHaveProperty("sendFailed");
      expect(summary.skipped).toHaveProperty("confirmFailed");
      expect(summary.skipped).toHaveProperty("logFailed");
    });

    it("tracks duration accurately", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const request = createMockCronRequest("/api/cron/welcome-email", {
        authMethod: "vercel-header",
      });

      const response = await GET(request);
      const data = await expectCronSuccess(response);

      expect(typeof data.data.summary.durationMs).toBe("number");
      expect(data.data.summary.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
