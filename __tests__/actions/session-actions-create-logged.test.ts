/**
 * @jest-environment node
 */

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

type MockFn = jest.MockedFunction<(...args: any[]) => any>;

const mockUser = { id: "user-123" };
let mockSupabase: ReturnType<typeof createSupabaseMock>;
let mockComputeUserPreferences: jest.MockedFunction<(userId: string) => Promise<any>>;
let createLoggedSession: typeof import("@/actions/session-actions").createLoggedSession;

function createSupabaseMock() {
  return {
    from: jest.fn().mockReturnThis() as MockFn,
    select: jest.fn().mockReturnThis() as MockFn,
    insert: jest.fn().mockReturnThis() as MockFn,
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
  mockComputeUserPreferences = jest.fn(async () => null);

  jest.doMock("next/cache", () => ({
    revalidatePath: jest.fn(),
  }));

  jest.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseServiceRoleClient: jest.fn(() => mockSupabase),
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
    expect(mockSupabase.from).toHaveBeenCalledWith("forecast_feedback_contexts");
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "session-123",
      }),
    );
    expect(mockSupabase.eq).toHaveBeenCalledWith(
      "id",
      "123e4567-e89b-42d3-a456-426614174999",
    );
    expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(mockSupabase.eq).toHaveBeenCalledWith("beach_id", "beach-123");
    expect(mockSupabase.is).toHaveBeenCalledWith("session_id", null);

    const sessionsInsertCall = mockSupabase.insert.mock.calls.find(
      ([payload]) => payload?.beach_name === "Ocean Beach",
    );
    expect(sessionsInsertCall?.[0]).not.toHaveProperty(
      "forecast_feedback_context_id",
    );
  });
});
