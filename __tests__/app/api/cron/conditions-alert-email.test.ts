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

// Mock Supabase client
const mockRpc = jest.fn();
const defaultFromImpl = (_table?: string) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      gte: jest.fn(() => ({
        lt: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
});
const mockFrom = jest.fn(defaultFromImpl);

// Shared beach-metadata row for the re-score path tests. Mirrors the columns
// the route selects from `beaches`.
const RESCORE_BEACH_ROW = {
  id: "beach-1",
  name: "Test Beach",
  slug: "test-beach",
  skill_level: "beginner",
  swell_window_center_deg: 315,
  swell_window_halfwidth_deg: 45,
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 45,
  preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 4,
  timezone: "America/Los_Angeles",
};

// Builds a `from()` implementation that serves one beach's day forecasts and
// metadata row, falling back to the empty-result default for any other table.
// Both queries are thunks so callers can resolve (happy path) or reject (fetch
// failure) the enhanced_forecasts and/or beaches queries independently — the
// route fails closed on a forecast error but degrades gracefully on a beaches
// error. Centralizes the verbose Supabase query-chain shape so the re-score
// tests don't each re-derive it.
function mockBeachForecastFrom(
  forecastsResult: () => Promise<unknown>,
  beachResult: () => Promise<unknown> = () =>
    Promise.resolve({ data: RESCORE_BEACH_ROW, error: null })
) {
  return ((table?: string) => {
    if (table === "enhanced_forecasts") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lt: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => forecastsResult()),
                })),
              })),
            })),
          })),
        })),
      };
    }

    if (table === "beaches") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => beachResult()),
          })),
        })),
      };
    }

    return defaultFromImpl(table);
  }) as unknown as typeof defaultFromImpl;
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
      from: mockFrom,
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

// Mock signal enrichment — the route calls this per candidate; it degrades
// gracefully, so a fixed empty-ish payload keeps these tests focused on the
// cron orchestration rather than the enrichment internals.
const mockEnrichBeachSignals = jest.fn();
jest.mock("@/lib/email/signal-enrichment", () => ({
  enrichBeachSignals: (...args: unknown[]) => mockEnrichBeachSignals(...args),
}));

// Mock the digest service — the route reuses evaluateDigestMatch to derive the
// why bullets + crowd warning. Default to an empty (no-match) result.
const mockEvaluateDigestMatch = jest.fn();
jest.mock("@/lib/services/forecast-digest-service", () => ({
  evaluateDigestMatch: (...args: unknown[]) => mockEvaluateDigestMatch(...args),
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
    if (score >= 85) return { label: "EPIC", color: "#00D4AA" };
    if (score >= 70) return { label: "GOOD", color: "#1D9E75" };
    return { label: "FAIR", color: "#FDB84B" };
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

jest.mock("@/lib/utils/beach-url-utils", () => ({
  buildBeachUrl: jest.fn(({ slug }: { slug: string }) => `/beach/${slug}`),
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
  const routeSource = readFileSync("app/api/cron/conditions-alert-email/route.ts", "utf8");
  let consoleLogSpy: jest.SpyInstance;

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
    // Restore the default table-agnostic from() behavior (some tests override it).
    mockFrom.mockImplementation(defaultFromImpl);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
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

    // Default enrichment: every signal null (graceful-degradation baseline).
    mockEnrichBeachSignals.mockResolvedValue({
      ripRisk: null,
      rideableWavesPerHour: null,
      setIntervalSeconds: null,
      waveFrequencyConfidence: null,
      forecastConfidence: null,
      conditionCharacter: null,
    });

    // Default digest evaluation: no match → empty why content.
    mockEvaluateDigestMatch.mockReturnValue({
      isMatch: false,
      matchQuality: "no_match",
      whyText: [],
      crowdWarning: null,
      bestWindow: null,
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("Authentication", () => {
    it("uses the API wrapper barrel for response helpers and cron request validation", () => {
      expect(routeSource).not.toContain("@/lib/api-utils");
      expect(routeSource).toContain("@/lib/middleware/api-wrappers");
    });

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
          rescoreFailed: 0,
          scoreBelowFloor: 0,
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

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(request);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error claiming slot for user user-1"),
        expect.objectContaining({ message: "RPC error" })
      );
      consoleErrorSpy.mockRestore();
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
    it("should send email with correct parameters and plain score subject", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "John Doe",
          experience_level: "intermediate",
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
        subject: "Ocean Beach: 90 today",
        react: "ConditionsAlertEmail", // Mocked component
      });
    });

    it.each([
      { score: 90, expectedSubject: "Test Beach: 90 today" },
      { score: 80, expectedSubject: "Test Beach: 80 today" },
      { score: 70, expectedSubject: "Test Beach: 70 today" },
    ])("should use a plain score subject for score $score", async ({ score, expectedSubject }) => {
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
          experience_level: "intermediate",
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

      expect(ConditionsAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          beachName: "Ocean Beach",
          conditionsScore: 90,
          surfDescription: "Clean 3-4ft",
          windDescription: "Light offshore",
          bestWindow: {
            start: "8:00 AM",
            end: "10:00 AM",
          },
          ctaUrl: "https://quiversurf.app/beach/ocean-beach",
          manageUrl: "https://quiversurf.app/settings",
          unsubscribeUrl: "https://quiversurf.app/settings",
        })
      );
    });

    it("passes enrichment signals + digest why content to the template", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "John Doe",
          experience_level: "intermediate",
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
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      const signals = {
        ripRisk: "moderate",
        rideableWavesPerHour: 18,
        setIntervalSeconds: 90,
        waveFrequencyConfidence: "high",
        forecastConfidence: 82,
        conditionCharacter: "Dialed — everything's lining up",
      };
      mockEnrichBeachSignals.mockResolvedValueOnce(signals);
      mockEvaluateDigestMatch.mockReturnValueOnce({
        isMatch: true,
        matchQuality: "perfect",
        whyText: ["Optimal NW swell window."],
        crowdWarning: "Expect crowds.",
        bestWindow: null,
      });

      // Return a populated beach + forecast row so deriveWhyContent reaches
      // evaluateDigestMatch (it short-circuits when either is missing). Route by
      // table name since the route queries both enhanced_forecasts and beaches.
      mockFrom.mockImplementation(((table?: string) => {
        if (table === "enhanced_forecasts") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  lt: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() =>
                        Promise.resolve({
                          data: [
                            {
                              id: "f1",
                              beach_id: "beach-1",
                              forecast_at: "2026-06-13T15:00:00Z",
                              forecast_date: "2026-06-13",
                              forecast_time: "08:00:00",
                              wave_height: "3-4 ft",
                              wave_period: "12",
                              wave_direction: "NW",
                              wind_speed: "5",
                              wind_direction_deg: 90,
                              tide_height: "2.1",
                              tide_status: "incoming",
                            },
                          ],
                          error: null,
                        })
                      ),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        // beaches
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: {
                    id: "beach-1",
                    name: "Ocean Beach",
                    slug: "ocean-beach",
                    skill_level: "intermediate",
                    swell_window_center_deg: 315,
                    swell_window_halfwidth_deg: 45,
                    wind_offshore_deg: 90,
                    wind_offshore_tol_deg: 45,
                    preferred_tide_ft_min: 1,
                    preferred_tide_ft_max: 4,
                    timezone: "America/Los_Angeles",
                  },
                  error: null,
                })
              ),
            })),
          })),
        };
      }) as unknown as typeof defaultFromImpl);

      const { ConditionsAlertEmail } = require("@/lib/mailer/templates/ConditionsAlertEmail");
      const request = mockRequest({ authorization: "Bearer valid" });
      await GET(request);

      expect(mockEnrichBeachSignals).toHaveBeenCalledWith(
        expect.anything(),
        "beach-1",
        expect.any(String)
      );
      expect(ConditionsAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          signals,
          why: {
            whyText: ["Optimal NW swell window."],
            crowdWarning: "Expect crowds.",
          },
          dateline: expect.any(String),
        })
      );
    });

    it("should handle null best window", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          experience_level: "intermediate",
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

    it("uses the best-scoring forecast slot for both fresh score and tide description", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          experience_level: "beginner",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          beach_state: "CA",
          beach_city: "San Diego",
          conditions_score: 72,
          surf_description: "Clean 2ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      mockFrom.mockImplementation(
        mockBeachForecastFrom(() =>
          Promise.resolve({
            data: [
              {
                id: "dawn",
                beach_id: "beach-1",
                forecast_at: "2026-06-13T13:00:00Z",
                wave_height: "0.5 ft",
                wave_period: "8s",
                wave_direction: "NW",
                wind_speed: "5 mph",
                wind_direction_deg: 90,
                tide_height: "0.4",
                tide_status: "Low",
                swell_1_period: "8s",
                created_at: "2026-06-13T00:00:00Z",
                updated_at: "2026-06-13T00:00:00Z",
              },
              {
                id: "best",
                beach_id: "beach-1",
                forecast_at: "2026-06-13T21:00:00Z",
                wave_height: "2 ft",
                wave_period: "17s",
                wave_direction: "NW",
                wind_speed: "4 mph",
                wind_direction_deg: 90,
                tide_height: "2.8",
                tide_status: "Falling",
                swell_1_period: "17s",
                created_at: "2026-06-13T00:00:00Z",
                updated_at: "2026-06-13T00:00:00Z",
              },
            ],
            error: null,
          })
        )
      );

      const { ConditionsAlertEmail } = require("@/lib/mailer/templates/ConditionsAlertEmail");

      const request = mockRequest({ authorization: "Bearer valid-cron-secret" });
      await GET(request);

      // The "best" slot (2ft @ 17s, 4mph wind, 2.8ft falling tide) scored as
      // beginner (ideal 1-3ft, peak 2ft): wave 45 (at peak) + energy 20 (>=13s)
      // + wind ~16.7 (25*(1-4/12)) + tide 10 (in-range 8, +2 falling) = 92.
      // Update this expectation if the native scorer's component weights change.
      expect(ConditionsAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionsScore: 92,
          tideDescription: "2.8 ft, Falling",
        })
      );
      expect(mockFrom).not.toHaveBeenCalledWith("profiles");
    });

    it("skips sending when fresh native scoring falls below the alert floor", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          experience_level: "beginner",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          beach_state: "CA",
          beach_city: "San Diego",
          conditions_score: 75,
          surf_description: "Stored score looked good",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      mockFrom.mockImplementation(
        mockBeachForecastFrom(() =>
          Promise.resolve({
            data: [
              {
                id: "too-small",
                beach_id: "beach-1",
                forecast_at: "2026-06-13T16:00:00Z",
                wave_height: "1 ft",
                wave_period: "8s",
                wave_direction: "NW",
                wind_speed: "4 mph",
                wind_direction_deg: 90,
                tide_height: "2.0",
                tide_status: "Rising",
                swell_1_period: "8s",
                created_at: "2026-06-13T00:00:00Z",
                updated_at: "2026-06-13T00:00:00Z",
              },
            ],
            error: null,
          })
        )
      );

      const request = mockRequest({ authorization: "Bearer valid-cron-secret" });
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.scoreBelowFloor).toBe(1);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("fails closed (claims slot, no send) when fresh re-scoring throws", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          experience_level: "intermediate",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          beach_state: "CA",
          beach_city: "San Diego",
          conditions_score: 80,
          surf_description: "Stored score looked good",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      // Forecast fetch rejects → the re-score try/catch fires. The stored score
      // (80) is >= MIN_SCORE, so without the fail-closed guard this would send
      // an unverified alert. Assert we skip instead.
      mockFrom.mockImplementation(
        mockBeachForecastFrom(() =>
          Promise.reject(new Error("forecast fetch failed"))
        )
      );

      const request = mockRequest({ authorization: "Bearer valid-cron-secret" });
      const response = await GET(request);
      const data = await response.json();

      // The slot must still be claimed before we fail closed — that is what
      // prevents the cron from retrying this candidate all day.
      expect(mockRpc).toHaveBeenCalledWith(
        "claim_forecast_delivery_slot",
        expect.objectContaining({ p_user_id: "user-1" })
      );
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.rescoreFailed).toBe(1);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("still sends (with degraded why-content) when only the beach metadata fetch fails", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          experience_level: "beginner",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          beach_state: "CA",
          beach_city: "San Diego",
          conditions_score: 72,
          surf_description: "Clean 2ft",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      // Forecasts re-score fine (best slot scores 92), but the beaches fetch
      // rejects. Beach metadata only powers the why-bullets, so the send must
      // proceed on the verified fresh score rather than failing closed.
      mockFrom.mockImplementation(
        mockBeachForecastFrom(
          () =>
            Promise.resolve({
              data: [
                {
                  id: "best",
                  beach_id: "beach-1",
                  forecast_at: "2026-06-13T21:00:00Z",
                  wave_height: "2 ft",
                  wave_period: "17s",
                  wave_direction: "NW",
                  wind_speed: "4 mph",
                  wind_direction_deg: 90,
                  tide_height: "2.8",
                  tide_status: "Falling",
                  swell_1_period: "17s",
                  created_at: "2026-06-13T00:00:00Z",
                  updated_at: "2026-06-13T00:00:00Z",
                },
              ],
              error: null,
            }),
          () => Promise.reject(new Error("beach metadata fetch failed"))
        )
      );

      const { ConditionsAlertEmail } = require("@/lib/mailer/templates/ConditionsAlertEmail");

      const request = mockRequest({ authorization: "Bearer valid-cron-secret" });
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.summary.sent).toBe(1);
      expect(data.data.summary.skipped.rescoreFailed).toBe(0);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(ConditionsAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({ conditionsScore: 92 })
      );
    });

    it("sends on the stored score when there are no fresh forecast slots", async () => {
      const candidates = [
        {
          user_id: "user-1",
          email: "user1@example.com",
          display_name: "User One",
          experience_level: "intermediate",
          home_beach_id: "beach-1",
          beach_name: "Test Beach",
          beach_slug: "test-beach",
          beach_state: "CA",
          beach_city: "San Diego",
          conditions_score: 75,
          surf_description: "Clean conditions",
          wind_description: "Light offshore",
          best_window_start: null,
          best_window_end: null,
          recommendation: null,
        },
      ];

      mockRpc
        .mockResolvedValueOnce({ data: candidates, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      // Empty forecast result (not an error) — best-effort: fall through on the
      // RPC-gated stored score (75) rather than failing closed.
      mockFrom.mockImplementation(
        mockBeachForecastFrom(() =>
          Promise.resolve({ data: [], error: null })
        )
      );

      const { ConditionsAlertEmail } = require("@/lib/mailer/templates/ConditionsAlertEmail");

      const request = mockRequest({ authorization: "Bearer valid-cron-secret" });
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.summary.sent).toBe(1);
      expect(data.data.summary.skipped.rescoreFailed).toBe(0);
      expect(data.data.summary.skipped.scoreBelowFloor).toBe(0);
      expect(ConditionsAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({ conditionsScore: 75 })
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

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(request);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send to user user-1"),
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
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

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(request);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error processing candidate user-1"),
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
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
        subject: "Test Beach: 90 today",
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
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(request);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send to user user-3"),
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary).toEqual({
        candidates: 3,
        sent: 1,
        durationMs: expect.any(Number),
        skipped: {
          claimFailed: 1,
          rescoreFailed: 0,
          scoreBelowFloor: 0,
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
