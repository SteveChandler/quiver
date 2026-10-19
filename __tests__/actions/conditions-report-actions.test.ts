/**
 * @jest-environment node
 *
 * Tests for actions/conditions-report-actions.ts
 *
 * Covers:
 * submitConditionsReport:
 *   - Successful submission (creates intel post + session)
 *   - Same-day dedup: returns ALREADY_REPORTED_TODAY
 *   - Missing / invalid beachId
 *   - Invalid wave size selection
 *   - Invalid vibe selection
 *   - Note over 280 chars is rejected
 *   - Intel post insert failure
 *   - Session insert failure is non-fatal (report still succeeds)
 *   - Beach lookup failure
 *
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import {
  expectConsoleErrors,
  expectConsoleWarnings,
} from "@/__tests__/setup/test-utils";

// Mock Next.js cache functions
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

type MockFn = jest.MockedFunction<(...args: any[]) => any>;

const createSupabaseMock = () => {
  const mock = {
    from: jest.fn().mockReturnThis() as MockFn,
    select: jest.fn().mockReturnThis() as MockFn,
    insert: jest.fn().mockReturnThis() as MockFn,
    update: jest.fn().mockImplementation(() => ({
      eq: jest.fn().mockImplementation(() => Promise.resolve({ error: null })) as unknown as MockFn,
    })) as unknown as MockFn,
    eq: jest.fn().mockReturnThis() as MockFn,
    not: jest.fn().mockReturnThis() as MockFn,
    gte: jest.fn().mockReturnThis() as MockFn,
    order: jest.fn().mockReturnThis() as MockFn,
    in: jest.fn().mockReturnThis() as MockFn,
    limit: jest.fn() as MockFn,
    single: jest.fn() as MockFn,
    auth: {
      getUser: jest.fn() as MockFn,
    },
  };
  return mock;
};

/** Helper: pass mock supabase to createSupabaseServerClient without type friction */
const mockSupabaseClient = (supabase: ReturnType<typeof createSupabaseMock>) => {
  createSupabaseServerClient.mockResolvedValue(supabase as any);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = { id: "user-test-123" };

// Beach record returned by the beaches lookup
const mockBeach = { center_lat: 32.75, center_lng: -117.25, name: "Ocean Beach" };

// A completed intel_posts insert result
const mockIntelPost = { id: "intel-post-abc" };

// A completed sessions insert result
const mockSession = { id: "session-xyz" };

let mockSubmitForecastFeedback: jest.MockedFunction<(...args: any[]) => any>;

/** Simulate no existing reports today (dedup check returns empty) */
const noExistingReports = { data: [], error: null };

/** Simulate an existing report today (dedup check returns a row) */
const existingReportToday = { data: [{ id: "existing-post" }], error: null };

// ---------------------------------------------------------------------------
// Module under test — imported dynamically to allow mocking
// ---------------------------------------------------------------------------

let submitConditionsReport: (
  input: import("@/types/conditions-report").ConditionsReportInput
) => Promise<any>;
let createSupabaseServerClient: jest.MockedFunction<any>;

beforeEach(async () => {
  jest.resetModules();

  // Mock the Supabase server client so we control all DB interactions
  jest.mock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseServiceRoleClient: jest.fn(),
  }));
  jest.mock("@/lib/forecast-feedback/submit-feedback", () => ({
    submitForecastFeedback: jest.fn(),
  }));

  const serverModule = await import("@/lib/supabase/server");
  createSupabaseServerClient = serverModule.createSupabaseServerClient as jest.MockedFunction<any>;
  const feedbackModule = await import("@/lib/forecast-feedback/submit-feedback");
  mockSubmitForecastFeedback = feedbackModule.submitForecastFeedback as jest.MockedFunction<
    (...args: any[]) => any
  >;
  mockSubmitForecastFeedback.mockResolvedValue({
    success: true,
    data: {
      id: "feedback-1",
      contractVersion: "forecast-feedback-context.v1",
      correlationId: "corr-1",
    },
  });

  const actionsModule = await import("@/actions/conditions-report-actions");
  submitConditionsReport = actionsModule.submitConditionsReport as any;
});

// ---------------------------------------------------------------------------
// submitConditionsReport
// ---------------------------------------------------------------------------

describe("submitConditionsReport", () => {
  describe("Input validation", () => {
    test("rejects empty beachId", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      const result = await submitConditionsReport({
        beachId: "",
        waveSizeRange: "3-4ft",
        vibe: "firing",
      });

      const inner = result?.data ?? result;
      expect(inner.success).toBe(false);
      expect(inner.error).toMatch(/beach id/i);
    });

    test("rejects invalid waveSizeRange", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "10ft+" as any,
        vibe: "firing",
      });

      const inner = result?.data ?? result;
      expect(inner.success).toBe(false);
      expect(inner.error).toMatch(/wave size/i);
    });

    test("rejects invalid vibe", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "3-4ft",
        vibe: "epic" as any,
      });

      const inner = result?.data ?? result;
      expect(inner.success).toBe(false);
      expect(inner.error).toMatch(/vibe/i);
    });

    test("rejects note longer than 280 characters", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "3-4ft",
        vibe: "firing",
        note: "x".repeat(281),
      });

      const inner = result?.data ?? result;
      expect(inner.success).toBe(false);
      expect(inner.error).toMatch(/280/);
    });
  });

  describe("Same-day dedup", () => {
    test("returns ALREADY_REPORTED_TODAY when user has a report today", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      // Dedup check returns a row
      supabase.limit.mockResolvedValueOnce(existingReportToday);

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "3-4ft",
        vibe: "firing",
      });

      const inner = result?.data ?? result;
      expect(inner.success).toBe(false);
      expect(inner.error).toBe("ALREADY_REPORTED_TODAY");
    });
  });

  describe("Successful submission", () => {
    test("creates intel post and session, returns both IDs", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      // Dedup: no existing reports
      supabase.limit.mockResolvedValueOnce(noExistingReports);
      // Beach lookup
      supabase.single
        .mockResolvedValueOnce({ data: mockBeach, error: null })
        // Intel post insert
        .mockResolvedValueOnce({ data: mockIntelPost, error: null })
        // Session insert
        .mockResolvedValueOnce({ data: mockSession, error: null });

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "3-4ft",
        vibe: "firing",
        note: "Clean lines",
      });

      const inner = result?.data ?? result;
      expect(inner.success).toBe(true);
      expect(inner.data?.intelPostId).toBe("intel-post-abc");
      expect(inner.data?.sessionId).toBe("session-xyz");

      await new Promise((resolve) => setImmediate(resolve));
      expect(mockSubmitForecastFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ user: mockUser, supabase }),
        expect.objectContaining({
          beachId: "beach-1",
          forecastAt: expect.stringMatching(/:00\.000Z$/),
          feedbackKind: "condition_report",
          feedbackValue: "3-4ft",
          feedbackNote: "Clean lines",
          observedFaceHeightFt: 3.5,
          displayedContext: {
            source: "conditions_report",
            waveSizeRange: "3-4ft",
            vibe: "firing",
          },
        }),
        expect.objectContaining({ requireForecast: true }),
      );

      const sessionInsert = supabase.insert.mock.calls.find(
        ([payload]) => payload?.source === "conditions_report",
      );
      expect(sessionInsert?.[0]).toEqual(
        expect.objectContaining({ wave_height_ft: 3.5 }),
      );
    });

    test("stores the 3-5ft bucket at its 4ft midpoint", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      supabase.limit.mockResolvedValueOnce(noExistingReports);
      supabase.single
        .mockResolvedValueOnce({ data: mockBeach, error: null })
        .mockResolvedValueOnce({ data: mockIntelPost, error: null })
        .mockResolvedValueOnce({ data: mockSession, error: null });

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "3-5ft",
        vibe: "fun",
      });

      const inner = result?.data ?? result;
      expect(inner.success).toBe(true);
      const sessionInsert = supabase.insert.mock.calls.find(
        ([payload]) => payload?.source === "conditions_report",
      );
      expect(sessionInsert?.[0]).toEqual(expect.objectContaining({ wave_height_ft: 4 }));
    });

    test("emits intel_post_created and session_created, not session_log_submit", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      supabase.limit.mockResolvedValueOnce(noExistingReports);
      supabase.single
        .mockResolvedValueOnce({ data: mockBeach, error: null })
        .mockResolvedValueOnce({ data: mockIntelPost, error: null })
        .mockResolvedValueOnce({ data: mockSession, error: null });

      await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "3-4ft",
        vibe: "firing",
      });

      // Flush microtasks so fire-and-forget IIFEs complete before assertions.
      await new Promise((resolve) => setImmediate(resolve));

      expect(supabase.from).toHaveBeenCalledWith("user_events");
      expect(supabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          event_type: "intel_post_created",
          beach_id: "beach-1",
        })
      );
      expect(supabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          event_type: "session_created",
          beach_id: "beach-1",
          metadata: expect.objectContaining({
            source: "web-conditions-report",
            surface: "conditions-report",
            spot_type: "beach",
            user_id: mockUser.id,
            session_id: "session-xyz",
          }),
        })
      );
      const insertedEventTypes = supabase.insert.mock.calls
        .map(([payload]) => payload?.event_type)
        .filter(Boolean);
      expect(insertedEventTypes).not.toContain("session_log_submit");
    });

    test("succeeds even when session insert fails", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      supabase.limit.mockResolvedValueOnce(noExistingReports);
      supabase.single
        .mockResolvedValueOnce({ data: mockBeach, error: null })
        // Intel post insert succeeds
        .mockResolvedValueOnce({ data: mockIntelPost, error: null })
        // Session insert fails
        .mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "2-3ft",
        vibe: "fun",
      });

      // Session insert failure logs a warning — declare it intentional
      expectConsoleWarnings([/Session insert failed/i]);

      const inner = result?.data ?? result;
      expect(inner.success).toBe(true);
      expect(inner.data?.intelPostId).toBe("intel-post-abc");
      // sessionId is null because the insert failed (non-fatal)
      expect(inner.data?.sessionId).toBeNull();
    });

    test("succeeds when forecast feedback forwarding fails", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);
      mockSubmitForecastFeedback.mockRejectedValueOnce(new Error("Seaside unavailable"));

      supabase.limit.mockResolvedValueOnce(noExistingReports);
      supabase.single
        .mockResolvedValueOnce({ data: mockBeach, error: null })
        .mockResolvedValueOnce({ data: mockIntelPost, error: null })
        .mockResolvedValueOnce({ data: mockSession, error: null });

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "5+ft",
        vibe: "fun",
      });
      await new Promise((resolve) => setImmediate(resolve));

      const inner = result?.data ?? result;
      expect(inner.success).toBe(true);
      expect(inner.data?.intelPostId).toBe("intel-post-abc");
      expectConsoleWarnings([/Forecast feedback failed/i]);
    });
  });

  describe("Error paths", () => {
    test("returns error when beach lookup fails", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      supabase.limit.mockResolvedValueOnce(noExistingReports);
      supabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: "not found" },
      });

      const result = await submitConditionsReport({
        beachId: "beach-missing",
        waveSizeRange: "3-4ft",
        vibe: "meh",
      });

      // Beach lookup failure logs an error — declare it intentional
      expectConsoleErrors([/Beach lookup failed/i]);

      const inner = result?.data ?? result;
      expect(inner.success).toBe(false);
      expect(inner.error).toMatch(/beach not found/i);
    });

    test("returns error when intel post insert fails", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null } as any);
      mockSupabaseClient(supabase);

      supabase.limit.mockResolvedValueOnce(noExistingReports);
      supabase.single
        .mockResolvedValueOnce({ data: mockBeach, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: "insert failed" } });

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "4-5ft",
        vibe: "rough",
      });

      // Intel post insert failure logs an error — declare it intentional
      expectConsoleErrors([/Intel post insert failed/i]);

      const inner = result?.data ?? result;
      expect(inner.success).toBe(false);
      expect(inner.error).toMatch(/failed to submit/i);
    });
  });

  describe("Authentication", () => {
    test("returns error when user is not authenticated", async () => {
      const supabase = createSupabaseMock();
      supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null } as any);
      mockSupabaseClient(supabase);

      const result = await submitConditionsReport({
        beachId: "beach-1",
        waveSizeRange: "3-4ft",
        vibe: "firing",
      });

      // withAuthenticatedAction / makeAuthenticatedAction wraps auth failures
      expect(result.success).toBe(false);
    });
  });
});
