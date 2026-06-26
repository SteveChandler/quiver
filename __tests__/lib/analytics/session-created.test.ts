/**
 * @jest-environment node
 */

import {
  SESSION_CREATED_EVENT,
  SESSION_CREATED_NON_NORTH_STAR_EVENTS,
  emitSessionCreatedEvent,
  isNorthStarSessionEvent,
} from "@/lib/analytics/session-created";

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

function createSupabaseMock({
  profile = {
    is_mock: false,
    is_system_account: false,
    analytics_is_real_user: true,
    deleted_at: null,
  },
  sessionCount = 1,
}: {
  profile?: Record<string, unknown> | null;
  sessionCount?: number;
} = {}) {
  const userEventsInsert = jest.fn(() => resolved({ error: null }));

  const supabase = {
    from: jest.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => resolved({ data: profile, error: null })),
            })),
          })),
        };
      }

      if (table === "sessions") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() =>
              resolved({
                count: sessionCount,
                data: null,
                error: null,
              })
            ),
          })),
        };
      }

      if (table === "user_events") {
        return {
          insert: userEventsInsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { supabase, userEventsInsert };
}

describe("session_created analytics", () => {
  it("emits one canonical event per real session insert with north-star props", async () => {
    const { supabase, userEventsInsert } = createSupabaseMock({
      sessionCount: 1,
    });

    await emitSessionCreatedEvent(supabase as any, {
      userId: "user-123",
      session: { id: "session-123", beach_id: "beach-123" } as any,
      source: "web-session-form",
      surface: "sessions/new",
    });

    expect(userEventsInsert).toHaveBeenCalledTimes(1);
    expect(userEventsInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      event_type: SESSION_CREATED_EVENT,
      beach_id: "beach-123",
      metadata: {
        source: "web-session-form",
        surface: "sessions/new",
        is_first_session: true,
        spot_type: "beach",
        user_id: "user-123",
        session_id: "session-123",
      },
    });
  });

  it("excludes mock, system, and non-real analytics profiles", async () => {
    for (const profile of [
      { is_mock: true, is_system_account: false, analytics_is_real_user: true },
      { is_mock: false, is_system_account: true, analytics_is_real_user: true },
      { is_mock: false, is_system_account: false, analytics_is_real_user: false },
    ]) {
      const { supabase, userEventsInsert } = createSupabaseMock({ profile });

      await emitSessionCreatedEvent(supabase as any, {
        userId: "excluded-user",
        session: { id: "session-123", beach_id: "beach-123" } as any,
        source: "web-session-form",
        surface: "sessions/new",
      });

      expect(userEventsInsert).not.toHaveBeenCalled();
    }
  });

  it("does not count intent or funnel events as north-star session creation", () => {
    expect(isNorthStarSessionEvent(SESSION_CREATED_EVENT)).toBe(true);

    for (const eventType of SESSION_CREATED_NON_NORTH_STAR_EVENTS) {
      expect(isNorthStarSessionEvent(eventType)).toBe(false);
    }
  });
});
