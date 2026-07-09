/**
 * @jest-environment node
 */

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

type MockFn = jest.MockedFunction<(...args: any[]) => any>;

const mockUser = { id: "user-123" };
let mockSupabase: ReturnType<typeof createSupabaseMock>;
let mockServiceRoleSupabase: ReturnType<typeof createSupabaseMock>;
let mockComputeUserPreferences: jest.MockedFunction<(userId: string) => Promise<any>>;
let createLoggedSession: typeof import("@/actions/session-actions").createLoggedSession;

function createSupabaseMock() {
  return {
    from: jest.fn().mockReturnThis() as MockFn,
    select: jest.fn().mockReturnThis() as MockFn,
    insert: jest.fn().mockReturnThis() as MockFn,
    upsert: jest.fn().mockReturnThis() as MockFn,
    update: jest.fn().mockReturnThis() as MockFn,
    eq: jest.fn().mockReturnThis() as MockFn,
    is: jest.fn().mockReturnThis() as MockFn,
    ilike: jest.fn().mockReturnThis() as MockFn,
    limit: jest.fn().mockReturnThis() as MockFn,
    single: jest.fn() as MockFn,
  };
}

async function flushFireAndForget(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function loadAction(): Promise<void> {
  jest.resetModules();
  mockSupabase = createSupabaseMock();
  mockServiceRoleSupabase = createSupabaseMock();
  mockComputeUserPreferences = jest.fn(async () => null);

  jest.doMock("next/cache", () => ({
    revalidatePath: jest.fn(),
  }));

  jest.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseServiceRoleClient: jest.fn(() => mockServiceRoleSupabase),
  }));

  jest.doMock("@/lib/server-action-utils", () => ({
    withServerAction: async (fn: () => Promise<any>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    withAuthenticatedAction: async (fn: (user: typeof mockUser, supabase: typeof mockSupabase) => Promise<any>) => {
      try {
        return { success: true, data: await fn(mockUser, mockSupabase) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  }));

  jest.doMock("@/lib/services/preference-learning-service", () => ({
    computeUserPreferences: mockComputeUserPreferences,
  }));

  jest.doMock("@/lib/gamification", () => ({
    trackXP: jest.fn(async () => null),
  }));

  jest.doMock("@/lib/services/personalization-milestone-service", () => ({
    checkAndRecordMilestones: jest.fn(async () => null),
  }));

  ({ createLoggedSession } = await import("@/actions/session-actions"));
}

describe("createLoggedSession personalization recompute", () => {
  beforeEach(async () => {
    await loadAction();
    mockSupabase.single.mockResolvedValue({
      data: {
        id: "session-123",
        beach_id: "beach-123",
        duration_minutes: 90,
        rating: 4,
      },
      error: null,
    });
  });

  it("recomputes learned preferences after a completed session insert", async () => {
    const result = await createLoggedSession({
      beach_id: "beach-123",
      beach_name: "Ocean Beach",
      arrival_time: "2026-05-20 14:00:00+00",
      rating: 4,
      forecast_accuracy: "somewhat",
    });

    await flushFireAndForget();

    expect(result.success).toBe(true);
    expect(mockComputeUserPreferences).toHaveBeenCalledWith("user-123");
    expect(mockSupabase.from).toHaveBeenCalledWith("sessions");
    expect(mockSupabase.from).toHaveBeenCalledWith("user_events");
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        event_type: "session_created",
        beach_id: "beach-123",
        metadata: expect.objectContaining({
          source: "web-session-form",
          surface: "sessions/new",
          is_first_session: false,
          spot_type: "beach",
          user_id: "user-123",
          session_id: "session-123",
        }),
      })
    );
  });

  it("does not emit session_created for mock/internal users", async () => {
    const originalAllowE2E = process.env.ALLOW_E2E_MUTATIONS_DEV;
    process.env.ALLOW_E2E_MUTATIONS_DEV = "0";
    mockSupabase.single.mockReset();
    mockSupabase.single
      .mockResolvedValueOnce({
        data: {
          id: "session-123",
          beach_id: "beach-123",
          duration_minutes: 90,
          rating: 4,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          is_mock: true,
          is_system_account: false,
          analytics_is_real_user: false,
          deleted_at: null,
        },
        error: null,
      });

    try {
      const result = await createLoggedSession({
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        arrival_time: "2026-05-20 14:00:00+00",
        rating: 4,
      });

      await flushFireAndForget();

      expect(result.success).toBe(true);
      const insertedEventTypes = mockSupabase.insert.mock.calls
        .map(([payload]) => payload?.event_type)
        .filter(Boolean);
      expect(insertedEventTypes).not.toContain("session_created");
      expect(insertedEventTypes).toContain("session_log_submit");
    } finally {
      if (originalAllowE2E === undefined) {
        delete process.env.ALLOW_E2E_MUTATIONS_DEV;
      } else {
        process.env.ALLOW_E2E_MUTATIONS_DEV = originalAllowE2E;
      }
    }
  });

  it("persists recommendation attribution and emits session_created metadata", async () => {
    mockSupabase.single.mockReset();
    mockSupabase.single.mockResolvedValue({
      data: {
        id: "session-123",
        beach_id: "beach-123",
        beach_name: "HB Cliffs",
        duration_minutes: 90,
        rating: 2,
        recommendation_id: "beach:beach-123:2026-07-09T14:00:00.000Z",
        arrival_time: "2026-07-09 14:00:00+00",
      },
      error: null,
    });
    mockServiceRoleSupabase.upsert.mockResolvedValue({ error: null });

    const result = await createLoggedSession({
      beach_id: "beach-123",
      beach_name: "HB Cliffs",
      arrival_time: "2026-07-09 14:00:00+00",
      rating: 2,
      recommendation_id: "beach:beach-123:2026-07-09T14:00:00.000Z",
      recommendation_call_accuracy: "wrong",
      forecast_wave_height_ft: 4,
      forecast_tide_status: "rising",
      wave_height_correct: false,
      tide_status_correct: true,
      recommendation_context: {
        recommendationId: "beach:beach-123:2026-07-09T14:00:00.000Z",
        surface: "home_hero",
        rank: 1,
        score: 88,
        windowStart: "2026-07-09T14:00:00.000Z",
        windowEnd: "2026-07-09T17:00:00.000Z",
        mode: "log",
        timeSlot: "dawn-patrol",
      },
    } as any);

    await flushFireAndForget();

    expect(result.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("sessions");
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendation_id: "beach:beach-123:2026-07-09T14:00:00.000Z",
        recommendation_call_accuracy: "wrong",
        forecast_wave_height_ft: 4,
        forecast_tide_status: "rising",
        wave_height_correct: false,
        tide_status_correct: true,
      })
    );
    expect(mockSupabase.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        recommendation_context: expect.any(Object),
      })
    );
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "session_created",
        metadata: expect.objectContaining({
          session_id: "session-123",
          recommendation_id: "beach:beach-123:2026-07-09T14:00:00.000Z",
        }),
      })
    );
    expect(mockServiceRoleSupabase.from).toHaveBeenCalledWith(
      "recommendation_session_contexts"
    );
    expect(mockServiceRoleSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        session_id: "session-123",
        recommendation_id: "beach:beach-123:2026-07-09T14:00:00.000Z",
        source_surface: "home_hero",
        ranking_position: 1,
      }),
      { onConflict: "user_id,session_id,recommendation_id" }
    );
  });

  it("keeps session creation successful when preference recompute fails", async () => {
    mockComputeUserPreferences.mockRejectedValueOnce(new Error("recompute failed"));

    const result = await createLoggedSession({
      beach_id: "beach-123",
      beach_name: "Ocean Beach",
      arrival_time: "2026-05-20 14:00:00+00",
      rating: 4,
    });

    await flushFireAndForget();
    expectConsoleWarnings([/preference recompute failed/i]);

    expect(result.success).toBe(true);
    expect(mockComputeUserPreferences).toHaveBeenCalledWith("user-123");
  });

  it("links carried forecast feedback context to the created session", async () => {
    const result = await createLoggedSession({
      beach_id: "beach-123",
      beach_name: "Ocean Beach",
      arrival_time: "2026-05-20 14:00:00+00",
      forecast_accuracy: "inaccurate",
      forecast_feedback_context_id: "123e4567-e89b-42d3-a456-426614174999",
    });

    expect(result.success).toBe(true);
    expect(mockServiceRoleSupabase.from).toHaveBeenCalledWith(
      "forecast_feedback_contexts",
    );
    expect(mockServiceRoleSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "session-123",
        updated_at: expect.any(String),
      }),
    );
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockServiceRoleSupabase.eq).toHaveBeenCalledWith(
      "id",
      "123e4567-e89b-42d3-a456-426614174999",
    );
    expect(mockServiceRoleSupabase.eq).toHaveBeenCalledWith(
      "user_id",
      "user-123",
    );
    expect(mockServiceRoleSupabase.eq).toHaveBeenCalledWith(
      "beach_id",
      "beach-123",
    );
    expect(mockServiceRoleSupabase.is).toHaveBeenCalledWith("session_id", null);

    const sessionsInsertCall = mockSupabase.insert.mock.calls.find(
      ([payload]) => payload?.beach_name === "Ocean Beach",
    );
    expect(sessionsInsertCall?.[0]).not.toHaveProperty(
      "forecast_feedback_context_id",
    );
  });

  it("keeps session creation successful when feedback link update returns an error", async () => {
    mockServiceRoleSupabase.is.mockResolvedValueOnce({
      error: { message: "rls denied" },
    });

    const result = await createLoggedSession({
      beach_id: "beach-123",
      beach_name: "Ocean Beach",
      arrival_time: "2026-05-20 14:00:00+00",
      forecast_accuracy: "inaccurate",
      forecast_feedback_context_id: "123e4567-e89b-42d3-a456-426614174999",
    });

    expectConsoleWarnings([/forecast feedback link failed/i]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "session-123",
        beach_id: "beach-123",
      }),
    );
  });

  it("keeps session creation successful when feedback link update throws", async () => {
    mockServiceRoleSupabase.is.mockRejectedValueOnce(
      new Error("network down"),
    );

    const result = await createLoggedSession({
      beach_id: "beach-123",
      beach_name: "Ocean Beach",
      arrival_time: "2026-05-20 14:00:00+00",
      forecast_accuracy: "inaccurate",
      forecast_feedback_context_id: "123e4567-e89b-42d3-a456-426614174999",
    });

    expectConsoleWarnings([/forecast feedback link failed/i]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "session-123",
        beach_id: "beach-123",
      }),
    );
  });
});
