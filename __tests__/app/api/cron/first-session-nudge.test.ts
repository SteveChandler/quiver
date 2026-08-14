/**
 * Unit tests for First Session Nudge Cron Job API
 *
 * Test coverage:
 * - Onboarded user with intel data → personalized template, subject with beach name + "✨"
 * - Onboarded user without intel data → personalized fallback, subject with beach name, no emoji
 * - Non-onboarded user → generic template, subject = "Your first forecast is waiting"
 * - Score < 70 → subject has beach name but no "✨" emoji
 */

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: async (_options: unknown, handler: () => Promise<unknown>) => handler(),
}));

import { GET } from "@/app/api/cron/first-session-nudge/route";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";

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

// ============================================================================
// Supabase mock — supports chained query builder pattern
// ============================================================================

// Leaf terminators — these resolve promises and end a query chain
const mockLte = jest.fn();
const mockIn = jest.fn();
const mockOr = jest.fn();
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();

// Intermediate chain methods — return the shared chain object
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockFrom = jest.fn();

// Auth admin mock
const mockGetUserById = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
    auth: {
      admin: {
        getUserById: mockGetUserById,
      },
    },
  })),
}));

// ============================================================================
// Mailer mock
// ============================================================================

const mockEmailsSend = jest.fn();
jest.mock("@/lib/mailer/client", () => ({
  sendEmail: (...args: unknown[]) => mockEmailsSend(...args),
  MAIL_FROM: "Quiver <test@quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <test@quiversurf.app>",
  getBaseUrl: () => "https://quiversurf.app",
}));

jest.mock("@/lib/alerts/email-token", () => ({
  generateEmailUnsubscribeToken: jest.fn(() => "test-unsubscribe-token"),
}));

// ============================================================================
// Email template mocks
// ============================================================================

jest.mock("@/lib/mailer/templates/FirstSessionNudgeEmail", () => ({
  FirstSessionNudgeEmail: jest.fn(() => "FirstSessionNudgeEmail"),
}));

jest.mock("@/lib/mailer/templates/PersonalizedNudgeEmail", () => ({
  PersonalizedNudgeEmail: jest.fn(() => "PersonalizedNudgeEmail"),
}));

// ============================================================================
// Support service mocks
// ============================================================================

jest.mock("@/lib/email/email-formatters", () => ({
  formatDatabaseTime: jest.fn((time: string | null) => {
    if (!time) return null;
    const parts = time.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours > 12 ? hours - 12 : hours || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }),
  formatActionableBestWindow: jest.fn(
    (startTime: string | null, endTime: string | null) => {
      if (!startTime || !endTime) return null;
      const startParts = startTime.split(":");
      const endParts = endTime.split(":");
      const startHour = parseInt(startParts[0], 10);
      const endHour = parseInt(endParts[0], 10);
      if (startHour < 5 || startHour >= 21 || endHour <= startHour) {
        return null;
      }
      const format = (time: string): string => {
        const parts = time.split(":");
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const ampm = hours >= 12 ? "PM" : "AM";
        const displayHour = hours > 12 ? hours - 12 : hours || 12;
        return `${displayHour}:${minutes} ${ampm}`;
      };
      return { start: format(startTime), end: format(endTime) };
    }
  ),
}));

jest.mock("@/lib/services/email-logging-service", () => ({
  createEmailLogger: jest.fn(() => ({
    logDelivery: jest.fn().mockResolvedValue({ success: true }),
  })),
}));

const mockThrottle = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: jest.fn(() => ({
    throttle: mockThrottle,
  })),
}));

const mockResolveNotificationMajorEventHold = jest.fn();
jest.mock(
  "@/lib/recommendations/major-event-hold/adapters/notification",
  () => ({
    resolveNotificationMajorEventHold: (...args: unknown[]) =>
      mockResolveNotificationMajorEventHold(...args),
  })
);

function expectEmailAttribution(
  url: URL,
  emailType: string
): string {
  expect(url.searchParams.get("utm_source")).toBe("email");
  expect(url.searchParams.get("utm_medium")).toBe("email");
  expect(url.searchParams.get("utm_campaign")).toBe(emailType);
  expect(url.searchParams.get("email_type")).toBe(emailType);
  const messageInstanceId = url.searchParams.get("message_instance_id");
  expect(messageInstanceId).toEqual(expect.any(String));
  if (!messageInstanceId) {
    throw new Error("Expected message_instance_id");
  }
  return messageInstanceId;
}

// ============================================================================
// Test helpers
// ============================================================================

const mockRequest = (
  headers: Record<string, string> = {},
  url = "http://localhost/api/cron/first-session-nudge"
) =>
  ({
    url,
    headers: {
      get: jest.fn((name: string) => headers[name] || null),
    },
    json: jest.fn(() => Promise.resolve({})),
  }) as unknown as NextRequest;

/**
 * Wire up the Supabase chain mocks for a given sequence of table calls.
 *
 * The cron always hits tables in this order:
 *   1. profiles  — .from().select().gte().lte()         ← terminates at .lte()
 *   2. sessions  — .from().select().in()                ← terminates at .in()
 *   3. email_send_log — .from().select().in().or()      ← terminates at .or()
 *
 * For onboarded candidates (after auth lookup):
 *   4. beaches   — .from().select().eq().single()       ← terminates at .single()
 *   5. beach_daily_intel (×1 or ×2) — .from().select().eq().eq().order().limit().maybeSingle()
 *
 * Important: the sessions query and email_send_log query both call .in().
 *   - sessions: .in() IS the leaf → resolves data
 *   - email_send_log: .in() is an intermediate step → returns chain; .or() is the leaf
 * We handle this by making .in() return the chain by default (for the email_send_log path)
 * while using mockReturnValueOnce to deliver sessions data on the first .in() call.
 *
 * Actually the cleanest approach: use mockImplementation on .in() that tracks call count,
 * or simply make .in() always return the chain and add .or() as the only terminator for
 * email_send_log. For the sessions query we need .in() to resolve — we do that with
 * mockResolvedValueOnce on its first invocation, then mockReturnValue(chain) for subsequent.
 */
function setupSupabaseChain({
  profiles = [] as object[],
  sessions = [] as object[],
  emailLog = [] as object[],
  authUsers = [] as { user: { email: string } | null }[],
  suppressedEmails = [] as { email: string }[],
  suppressionError = null as { message: string } | null,
  beach = null as object | null,
  intel = null as object | null,
} = {}) {
  // Build a shared chain object. Every method returns itself except leaf terminators.
  const chain: Record<string, jest.Mock> = {
    select: mockSelect,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    or: mockOr,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  };

  // Re-establish createSupabaseServiceRoleClient after jest.resetAllMocks() clears it
  const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
  createSupabaseServiceRoleClient.mockReturnValue({
    from: mockFrom,
    auth: { admin: { getUserById: mockGetUserById } },
  });

  // All intermediate methods return the chain so further chaining works
  mockFrom.mockReturnValue(chain);
  mockSelect.mockReturnValue(chain);
  mockGte.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockOrder.mockReturnValue(chain);
  mockLimit.mockReturnValue(chain);

  // profiles: .gte().lte() — lte terminates
  mockLte.mockResolvedValue({ data: profiles, error: null });

  // sessions: first .in() call terminates (resolves sessions data)
  // email_send_log: second .in() call is a pass-through (returns chain); .or() terminates
  // email_suppression_list: third .in() call terminates (resolves suppressed emails)
  let inCallCount = 0;
  mockIn.mockImplementation(() => {
    inCallCount += 1;
    if (inCallCount === 1) {
      return Promise.resolve({ data: sessions, error: null });
    }
    if (inCallCount === 2) {
      return chain;
    }
    return Promise.resolve({
      data: suppressedEmails,
      error: suppressionError,
    });
  });

  // email_send_log: .or() terminates
  mockOr.mockResolvedValue({ data: emailLog, error: null });

  // beaches: .single() terminates
  mockSingle.mockResolvedValue({
    data: beach,
    error: beach ? null : { message: "Not found" },
  });

  // beach_daily_intel: .maybeSingle() terminates.
  // The cron tries tomorrow first, then today if tomorrow is null.
  // We always return the same intel value for both attempts — if intel is null,
  // both tomorrow and today return null, which is the "no intel" path.
  mockMaybeSingle.mockResolvedValue({ data: intel, error: null });

  // Auth mock — one call per candidate
  for (const authUser of authUsers) {
    mockGetUserById.mockResolvedValueOnce({ data: authUser });
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("First Session Nudge Cron Job API", () => {
  const routeSource = readFileSync(
    "app/api/cron/first-session-nudge/route.ts",
    "utf8"
  );
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // resetAllMocks clears calls AND implementation queues (mockResolvedValueOnce etc.)
    // This is necessary because setupSupabaseChain uses one-time return queues.
    jest.resetAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Restore the mocks that have permanent implementations (email send default)
    mockEmailsSend.mockResolvedValue({
      data: { id: "mock-resend-id" },
      error: null,
    });

    // validateCronRequest defaults to true
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(true);

    // createSuccessResponse / createErrorResponse / handleApiError defaults
    const apiUtils = require("@/lib/middleware/api-wrappers");
    apiUtils.createSuccessResponse.mockImplementation((data: unknown, status = 200) => ({
      json: jest.fn(() => Promise.resolve({ success: true, data, timestamp: new Date().toISOString() })),
      status,
    }));
    apiUtils.createErrorResponse.mockImplementation((error: unknown, details: unknown, status = 500) => ({
      json: jest.fn(() => Promise.resolve({ success: false, error, details, timestamp: new Date().toISOString() })),
      status,
    }));
    apiUtils.handleApiError.mockImplementation((error: unknown) => ({
      json: jest.fn(() => Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      })),
      status: 500,
    }));

    // email-logging-service default
    const { createEmailLogger } = require("@/lib/services/email-logging-service");
    createEmailLogger.mockReturnValue({
      logDelivery: jest.fn().mockResolvedValue({ success: true }),
    });

    // rate limiter default
    const { createResendRateLimiter } = require("@/lib/utils/email-rate-limiter");
    createResendRateLimiter.mockReturnValue({ throttle: mockThrottle });
    mockThrottle.mockResolvedValue(undefined);
    const { generateEmailUnsubscribeToken } = require("@/lib/alerts/email-token");
    generateEmailUnsubscribeToken.mockReturnValue("test-unsubscribe-token");
    mockResolveNotificationMajorEventHold.mockResolvedValue({
      status: "allowed",
      candidate: null,
    });

    // Restore formatter implementations (reset by jest.resetAllMocks)
    const {
      formatActionableBestWindow,
      formatDatabaseTime,
    } = require("@/lib/email/email-formatters");
    formatDatabaseTime.mockImplementation((time: string | null) => {
      if (!time) return null;
      const parts = time.split(":");
      const hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHour = hours > 12 ? hours - 12 : hours || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    });
    formatActionableBestWindow.mockImplementation(
      (startTime: string | null, endTime: string | null) => {
        if (!startTime || !endTime) return null;
        const startParts = startTime.split(":");
        const endParts = endTime.split(":");
        const startHour = parseInt(startParts[0], 10);
        const endHour = parseInt(endParts[0], 10);
        if (startHour < 5 || startHour >= 21 || endHour <= startHour) {
          return null;
        }
        const format = (time: string): string => {
          const parts = time.split(":");
          const hours = parseInt(parts[0], 10);
          const minutes = parts[1];
          const ampm = hours >= 12 ? "PM" : "AM";
          const displayHour = hours > 12 ? hours - 12 : hours || 12;
          return `${displayHour}:${minutes} ${ampm}`;
        };
        return { start: format(startTime), end: format(endTime) };
      }
    );
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  // --------------------------------------------------------------------------
  // Authentication
  // --------------------------------------------------------------------------

  describe("Authentication", () => {
    it("rejects requests without valid cron authentication", async () => {
      const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
      validateCronRequest.mockReturnValue(false);

      const response = await GET(mockRequest({ authorization: "Bearer invalid" }));
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
      expect(data.details).toBe("Invalid cron authentication");
      expect(response.status).toBe(401);
    });

    it("accepts a valid Bearer cron token", async () => {
      setupSupabaseChain({ profiles: [] });
      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Empty pipeline
  // --------------------------------------------------------------------------

  describe("Empty candidate pipeline", () => {
    it("returns empty summary when no users are in the signup window", async () => {
      setupSupabaseChain({ profiles: [] });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.candidates).toBe(0);
      expect(data.data.summary.sent).toBe(0);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("returns empty summary when all users in window already have sessions", async () => {
      setupSupabaseChain({
        profiles: [{ id: "user-1", display_name: "Surfer", home_beach_id: null, onboarding_completed_at: null }],
        sessions: [{ user_id: "user-1" }],
        emailLog: [],
        authUsers: [],
      });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.candidates).toBe(0);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("returns empty summary when all users already received the nudge", async () => {
      setupSupabaseChain({
        profiles: [{ id: "user-1", display_name: "Surfer", home_beach_id: null, onboarding_completed_at: null }],
        sessions: [],
        emailLog: [{ user_id: "user-1", email_type: "first_session_nudge" }],
        authUsers: [],
      });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.candidates).toBe(0);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Core branching logic — subject line assertions
  // --------------------------------------------------------------------------

  describe("Email template selection", () => {
    it("sends generic template to non-onboarded user", async () => {
      setupSupabaseChain({
        profiles: [{ id: "user-1", display_name: "Newbie", home_beach_id: null, onboarding_completed_at: null }],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "newbie@example.com" } }],
      });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(1);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "newbie@example.com",
          subject: "Your first forecast is waiting",
          unsubscribeUrl:
            "https://quiversurf.app/api/alerts/unsubscribe-email?user_id=user-1&token=test-unsubscribe-token",
        })
      );
    });

    it("sends personalized template with ✨ subject when score >= 70 (onboarded user with intel)", async () => {
      setupSupabaseChain({
        profiles: [
          {
            id: "user-2",
            display_name: "Regular",
            home_beach_id: "beach-42",
            onboarding_completed_at: "2026-03-01T10:00:00Z",
          },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "regular@example.com" } }],
        beach: {
          name: "Rincon",
          slug: "rincon",
          city: "Santa Barbara",
          state: "CA",
          country: "USA",
        },
        intel: {
          conditions_score: 75,
          surf_description: "Chest-high peeling rights",
          wind_description: "Light offshore",
          best_window_start: "07:00:00",
          best_window_end: "10:00:00",
        },
      });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(1);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "✨ Rincon — conditions are looking good",
        })
      );
    });

    it("downgrades held personalized beach and window content to the generic growth email", async () => {
      const { FirstSessionNudgeEmail } = require("@/lib/mailer/templates/FirstSessionNudgeEmail");
      const beachId = "11111111-1111-4111-8111-111111111111";
      setupSupabaseChain({
        profiles: [
          {
            id: "user-held",
            display_name: "Held Surfer",
            experience_level: "beginner",
            home_beach_id: beachId,
            onboarding_completed_at: "2026-06-26T10:00:00Z",
          },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "held@example.com" } }],
        beach: {
          name: "Pipeline",
          slug: "pipeline",
          city: "Haleiwa",
          state: "HI",
          country: "USA",
          timezone: "Pacific/Honolulu",
        },
        intel: {
          forecast_date: "2026-06-27",
          conditions_score: 88,
          surf_description: "Overhead barrels",
          wind_description: "Light offshore",
          best_window_start: "06:00:00",
          best_window_end: "09:00:00",
        },
      });
      mockResolveNotificationMajorEventHold.mockResolvedValue({
        status: "suppressed",
        reasonCode: "major_event_hold",
        auditCode: "major_event_hold",
        candidate: null,
      });

      const response = await GET(
        mockRequest({ authorization: "Bearer test-cron-secret" })
      );
      const data = await response.json();

      expect(data.data.summary.sent).toBe(1);
      expect(mockResolveNotificationMajorEventHold).toHaveBeenCalledWith({
        eventId: `first-session-nudge-email:user-held:${beachId}`,
        type: "log_session_nudge",
        payload: {
          cohort: "free_home_firing",
          policy_context: {
            kind: "positive_session_recommendation",
            beach_id: beachId,
            starts_at: "2026-06-27T16:00:00.000Z",
            ends_at: "2026-06-27T19:00:00.000Z",
          },
        },
        profileExperience: "beginner",
      });
      expect(mockThrottle.mock.invocationCallOrder[0]).toBeLessThan(
        mockResolveNotificationMajorEventHold.mock.invocationCallOrder[0]
      );
      expect(mockResolveNotificationMajorEventHold.mock.invocationCallOrder[0]).toBeLessThan(
        mockEmailsSend.mock.invocationCallOrder[0]
      );
      const sent = mockEmailsSend.mock.calls[0][0];
      expect(sent.subject).toBe("Your first forecast is waiting");
      expect(sent.react.type).toBe(FirstSessionNudgeEmail);
      expect(sent.react.props).not.toHaveProperty("beachName");
      const logSessionUrl = new URL(sent.react.props.logSessionUrl);
      expect(logSessionUrl.searchParams.get("beachId")).toBeNull();
      expect(logSessionUrl.searchParams.get("startedAt")).toBeNull();
      expect(JSON.stringify(sent)).not.toContain("policy_context");
    });

    it.each([
      [
        "a nonexistent DST time",
        "2026-03-08",
        "02:30:00",
        "03:30:00",
        "America/Los_Angeles",
      ],
      [
        "an ambiguous DST-fold time",
        "2026-11-01",
        "01:30:00",
        "03:00:00",
        "America/New_York",
      ],
    ])(
      "downgrades %s to generic copy",
      async (_label, forecastDate, windowStart, windowEnd, timezone) => {
        const beachId = "11111111-1111-4111-8111-111111111111";
        setupSupabaseChain({
          profiles: [
            {
              id: "user-dst",
              display_name: "DST Surfer",
              experience_level: "beginner",
              home_beach_id: beachId,
              onboarding_completed_at: "2026-03-07T10:00:00Z",
            },
          ],
          sessions: [],
          emailLog: [],
          authUsers: [{ user: { email: "dst@example.com" } }],
          beach: {
            name: "DST Beach",
            slug: "dst-beach",
            city: "Test",
            state: "CA",
            country: "USA",
            timezone,
          },
          intel: {
            forecast_date: forecastDate,
            conditions_score: 88,
            surf_description: "Clean",
            wind_description: "Light offshore",
            best_window_start: windowStart,
            best_window_end: windowEnd,
          },
        });
        mockResolveNotificationMajorEventHold.mockImplementation(
          async ({ payload }: { payload: { policy_context?: unknown } }) =>
            payload.policy_context
              ? { status: "allowed", candidate: null }
              : {
                  status: "suppressed",
                  reasonCode: "hold_state_unavailable",
                  auditCode: "major_event_hold",
                  candidate: null,
                }
        );

        await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));

        expect(mockResolveNotificationMajorEventHold).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: { cohort: "free_home_firing" },
          })
        );
        const sent = mockEmailsSend.mock.calls[0][0];
        expect(sent.subject).toBe("Your first forecast is waiting");
        expect(sent.react.props).not.toHaveProperty("beachName");
      }
    );

    it("preserves already-absolute best-window instants in the internal policy binding", async () => {
      const beachId = "11111111-1111-4111-8111-111111111111";
      setupSupabaseChain({
        profiles: [
          {
            id: "user-absolute",
            display_name: "Absolute Surfer",
            experience_level: "intermediate",
            home_beach_id: beachId,
            onboarding_completed_at: "2026-06-26T10:00:00Z",
          },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "absolute@example.com" } }],
        beach: {
          name: "Pipeline",
          slug: "pipeline",
          city: "Haleiwa",
          state: "HI",
          country: "USA",
          timezone: "Pacific/Honolulu",
        },
        intel: {
          forecast_date: "2026-06-27",
          conditions_score: 88,
          surf_description: "Clean",
          wind_description: "Light offshore",
          best_window_start: "2026-06-27T16:00:00.000Z",
          best_window_end: "2026-06-27T19:00:00.000Z",
        },
      });

      await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));

      expect(mockResolveNotificationMajorEventHold).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            cohort: "free_home_firing",
            policy_context: {
              kind: "positive_session_recommendation",
              beach_id: beachId,
              starts_at: "2026-06-27T16:00:00.000Z",
              ends_at: "2026-06-27T19:00:00.000Z",
            },
          },
        })
      );
    });

    it("sends personalized fallback subject (no emoji) when score < 70", async () => {
      setupSupabaseChain({
        profiles: [
          {
            id: "user-3",
            display_name: "Hodad",
            home_beach_id: "beach-99",
            onboarding_completed_at: "2026-03-01T12:00:00Z",
          },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "hodad@example.com" } }],
        beach: {
          name: "Huntington Beach",
          slug: "huntington-beach",
          city: "Huntington Beach",
          state: "CA",
          country: "USA",
        },
        intel: {
          conditions_score: 55,
          surf_description: "Messy ankle-slapper",
          wind_description: "Strong onshore",
          best_window_start: null,
          best_window_end: null,
        },
      });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(1);

      const sentCall = mockEmailsSend.mock.calls[0][0];
      expect(sentCall.subject).toContain("Huntington Beach");
      expect(sentCall.subject).not.toContain("✨");
      expect(sentCall.subject).toContain("check tomorrow's forecast");
    });

    it("sends personalized fallback subject when onboarded but intel data is null", async () => {
      setupSupabaseChain({
        profiles: [
          {
            id: "user-4",
            display_name: "LocalPro",
            home_beach_id: "beach-77",
            onboarding_completed_at: "2026-03-10T08:00:00Z",
          },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "localpro@example.com" } }],
        beach: {
          name: "Mavericks",
          slug: "mavericks",
          city: "Half Moon Bay",
          state: "CA",
          country: "USA",
        },
        intel: null, // both tomorrow and today return null
      });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(1);

      const sentCall = mockEmailsSend.mock.calls[0][0];
      expect(sentCall.subject).toContain("Mavericks");
      expect(sentCall.subject).not.toContain("✨");
      expect(sentCall.subject).toContain("check tomorrow's forecast");
    });
  });

  // --------------------------------------------------------------------------
  // Suppression filtering
  // --------------------------------------------------------------------------

  describe("Suppression filtering", () => {
    it("does not send to suppressed candidates and reports deliverable candidates", async () => {
      setupSupabaseChain({
        profiles: [
          { id: "deliverable-user", display_name: null, home_beach_id: null, onboarding_completed_at: null },
          { id: "suppressed-user", display_name: null, home_beach_id: null, onboarding_completed_at: null },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [
          { user: { email: "keep@example.com" } },
          { user: { email: "Blocked@Example.com" } },
        ],
        suppressedEmails: [{ email: "blocked@example.com" }],
      });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.candidates).toBe(1);
      expect(data.data.summary.sent).toBe(1);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "keep@example.com",
        })
      );
      expect(mockEmailsSend).not.toHaveBeenCalledWith(
        expect.objectContaining({
          to: "Blocked@Example.com",
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Email template prop verification
  // --------------------------------------------------------------------------

  describe("Email template props", () => {
    it("passes correct props to FirstSessionNudgeEmail for non-onboarded user", async () => {
      const { FirstSessionNudgeEmail } = require("@/lib/mailer/templates/FirstSessionNudgeEmail");

      setupSupabaseChain({
        profiles: [{ id: "user-1", display_name: "Shredder", home_beach_id: null, onboarding_completed_at: null }],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "shredder@example.com" } }],
      });

      await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));

      // The route uses React.createElement(FirstSessionNudgeEmail, props) — inspect the
      // React element stored in the `react` field of the Resend send call.
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      const sentArg = mockEmailsSend.mock.calls[0][0];
      expect(sentArg.react.type).toBe(FirstSessionNudgeEmail);
      expect(sentArg.react.props).toMatchObject({
        displayName: "Shredder",
        unsubscribeUrl: "https://quiversurf.app/settings",
      });
      const logSessionUrl = new URL(sentArg.react.props.logSessionUrl);
      expect(logSessionUrl.pathname).toBe("/sessions/new");
      expect(logSessionUrl.searchParams.get("mode")).toBe("log");
      expect(logSessionUrl.searchParams.get("quick")).toBe("true");
      expect(logSessionUrl.searchParams.get("entrySource")).toBe("email");
      expect(logSessionUrl.searchParams.get("source")).toBe(
        "first_session_nudge_email"
      );
      expectEmailAttribution(logSessionUrl, "first_session_nudge");
    });

    it("passes correct props to PersonalizedNudgeEmail for onboarded user with intel", async () => {
      const { PersonalizedNudgeEmail } = require("@/lib/mailer/templates/PersonalizedNudgeEmail");

      setupSupabaseChain({
        profiles: [
          {
            id: "user-5",
            display_name: "Pipeline Pete",
            home_beach_id: "beach-55",
            onboarding_completed_at: "2026-03-15T06:00:00Z",
          },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "pete@example.com" } }],
        beach: {
          name: "Pipeline",
          slug: "pipeline",
          city: "Haleiwa",
          state: "HI",
          country: "USA",
        },
        intel: {
          forecast_date: "2026-06-27",
          conditions_score: 88,
          surf_description: "Overhead+ barrels",
          wind_description: "Trade winds offshore",
          best_window_start: "06:00:00",
          best_window_end: "09:00:00",
        },
      });

      await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));

      // The route uses React.createElement(PersonalizedNudgeEmail, props) — inspect the
      // React element stored in the `react` field of the Resend send call.
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      const sentArg = mockEmailsSend.mock.calls[0][0];
      expect(sentArg.react.type).toBe(PersonalizedNudgeEmail);
      expect(sentArg.react.props).toMatchObject({
        displayName: "Pipeline Pete",
        beachName: "Pipeline",
        conditionsScore: 88,
        surfDescription: "Overhead+ barrels",
        windDescription: "Trade winds offshore",
        bestWindow: { start: "6:00 AM", end: "9:00 AM" },
        unsubscribeUrl: "https://quiversurf.app/settings",
      });
      const ctaUrl = new URL(sentArg.react.props.ctaUrl);
      expect(ctaUrl.pathname).toBe("/app/spot/pipeline");
      const ctaMessageId = expectEmailAttribution(ctaUrl, "first_session_nudge");

      const logSessionUrl = new URL(sentArg.react.props.logSessionUrl);
      expect(logSessionUrl.pathname).toBe("/sessions/new");
      expect(logSessionUrl.searchParams.get("beachId")).toBe("beach-55");
      expect(logSessionUrl.searchParams.get("startedAt")).toBe(
        "2026-06-27T06:00:00.000Z"
      );
      expect(logSessionUrl.searchParams.get("entrySource")).toBe("email");
      expect(logSessionUrl.searchParams.get("source")).toBe(
        "first_session_nudge_email"
      );
      expect(logSessionUrl.searchParams.get("beach_id")).toBeNull();
      expect(logSessionUrl.searchParams.get("window")).toBeNull();
      expectEmailAttribution(logSessionUrl, "first_session_nudge");
      expect(logSessionUrl.searchParams.get("message_instance_id")).toBe(
        ctaMessageId
      );
    });

    it("uses covered /app fallback when an onboarded user's beach has no app spot slug", async () => {
      const { PersonalizedNudgeEmail } = require("@/lib/mailer/templates/PersonalizedNudgeEmail");

      setupSupabaseChain({
        profiles: [
          {
            id: "user-no-slug",
            display_name: "No Slug",
            home_beach_id: "beach-no-slug",
            onboarding_completed_at: "2026-03-15T06:00:00Z",
          },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "noslug@example.com" } }],
        beach: {
          name: "Secret Spot",
          slug: null,
          city: "Encinitas",
          state: "CA",
          country: "USA",
        },
        intel: null,
      });

      await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));

      const sentArg = mockEmailsSend.mock.calls[0][0];
      expect(sentArg.react.type).toBe(PersonalizedNudgeEmail);
      const ctaUrl = new URL(sentArg.react.props.ctaUrl);
      expect(ctaUrl.pathname).toBe("/app");
      expectEmailAttribution(ctaUrl, "first_session_nudge");
    });

    it("suppresses overnight stored best windows in personalized emails", async () => {
      const { PersonalizedNudgeEmail } = require("@/lib/mailer/templates/PersonalizedNudgeEmail");

      setupSupabaseChain({
        profiles: [
          {
            id: "user-overnight",
            display_name: "Night Window",
            home_beach_id: "beach-night",
            onboarding_completed_at: "2026-03-15T06:00:00Z",
          },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "night@example.com" } }],
        beach: {
          name: "Ocean Beach",
          slug: "ocean-beach",
          city: "San Francisco",
          state: "CA",
          country: "USA",
        },
        intel: {
          conditions_score: 88,
          surf_description: "Clean",
          wind_description: "Light offshore",
          best_window_start: "02:00:00",
          best_window_end: "04:00:00",
        },
      });

      await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));

      const sentArg = mockEmailsSend.mock.calls[0][0];
      expect(sentArg.react.type).toBe(PersonalizedNudgeEmail);
      expect(sentArg.react.props).toEqual(
        expect.objectContaining({
          bestWindow: null,
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Send failure handling
  // --------------------------------------------------------------------------

  describe("Error handling", () => {
    it("increments sendFailed and continues when Resend returns an error", async () => {
      setupSupabaseChain({
        profiles: [{ id: "user-err", display_name: null, home_beach_id: null, onboarding_completed_at: null }],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "err@example.com" } }],
      });

      mockEmailsSend.mockResolvedValueOnce({ data: null, error: new Error("Resend API error") });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[first-session-nudge] Failed to send to user user-err:",
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();

      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.sendFailed).toBe(1);
    });

    it("throws and surfaces a profile query error", async () => {
      // Override lte to return an error — profile fetch fails
      const chain = {
        select: mockSelect,
        gte: mockGte,
        lte: mockLte,
        in: mockIn,
        or: mockOr,
        eq: mockEq,
        order: mockOrder,
        limit: mockLimit,
        single: mockSingle,
        maybeSingle: mockMaybeSingle,
      };
      const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
      createSupabaseServiceRoleClient.mockReturnValue({
        from: mockFrom,
        auth: { admin: { getUserById: mockGetUserById } },
      });
      mockFrom.mockReturnValue(chain);
      mockSelect.mockReturnValue(chain);
      mockGte.mockReturnValue(chain);
      mockLte.mockResolvedValueOnce({ data: null, error: { message: "DB failure" } });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      // handleApiError is called — success is false
      expect(data.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Rate limiting
  // --------------------------------------------------------------------------

  describe("Rate limiting", () => {
    it("calls throttle once per candidate", async () => {
      setupSupabaseChain({
        profiles: [
          { id: "u1", display_name: null, home_beach_id: null, onboarding_completed_at: null },
          { id: "u2", display_name: null, home_beach_id: null, onboarding_completed_at: null },
        ],
        sessions: [],
        emailLog: [],
        authUsers: [
          { user: { email: "a@example.com" } },
          { user: { email: "b@example.com" } },
        ],
      });

      mockThrottle.mockClear();
      await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));

      expect(mockThrottle).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // Summary statistics
  // --------------------------------------------------------------------------

  describe("Summary statistics", () => {
    it("returns correct durationMs type", async () => {
      setupSupabaseChain({ profiles: [] });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(typeof data.data.summary.durationMs).toBe("number");
      expect(data.data.summary.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("returns correct summary shape for a successful send", async () => {
      setupSupabaseChain({
        profiles: [{ id: "u1", display_name: null, home_beach_id: null, onboarding_completed_at: null }],
        sessions: [],
        emailLog: [],
        authUsers: [{ user: { email: "a@example.com" } }],
      });

      const response = await GET(mockRequest({ authorization: "Bearer test-cron-secret" }));
      const data = await response.json();

      expect(data.data.summary).toEqual({
        candidates: 1,
        sent: 1,
        durationMs: expect.any(Number),
        skipped: {
          sendFailed: 0,
          logFailed: 0,
        },
      });
    });
  });
});
