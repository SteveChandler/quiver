import {
  fetchRealActivitySignals,
  suppressSmallActivitySignals,
} from "@/lib/analytics/real-activity-signals";

describe("real beach activity signals", () => {
  it("does not let a mock account move the displayed count", async () => {
    const alertRows = Array.from({ length: 6 }, (_, index) => ({ user_id: `u${index}` }));
    const sessionRows = [
      { id: "s1", user_id: "u0" },
      { id: "s2", user_id: "u1" },
      { id: "s3", user_id: "mock" },
    ];
    const supabase = makeClient({
      alerts: alertRows,
      events: [
        ...Array.from({ length: 47 }, (_, index) => ({ id: `event-${index}`, user_id: "u0" })),
        { id: "mock-event", user_id: "mock" },
      ],
      sessions: sessionRows,
      profiles: [
        ...alertRows.map(({ user_id: id }, index) => ({
          id,
          is_mock: index === 0 ? null : false,
          is_system_account: index === 0 ? null : false,
        })),
        { id: "mock", is_mock: true, is_system_account: false },
      ],
    });

    await expect(fetchRealActivitySignals(supabase, "beach-1")).resolves.toEqual({
      watchers: 6,
      recentChecks: 47,
      loggedSessions: 2,
    });

    await expect(fetchRealActivitySignals(supabase, "beach-1").then(suppressSmallActivitySignals)).resolves
      .toMatchObject({ recentChecks: 47 });
  });

  it("suppresses each signal below the privacy threshold without changing measured values", () => {
    expect(suppressSmallActivitySignals({ watchers: 4, recentChecks: 5, loggedSessions: 0 })).toEqual({
      watchers: null,
      recentChecks: 5,
      loggedSessions: null,
    });
  });
});

function makeClient(data: {
  alerts: Array<{ user_id: string }>;
  events: Array<{ id: string; user_id: string }>;
  sessions: Array<{ id: string; user_id: string }>;
  profiles: Array<{ id: string; is_mock: boolean | null; is_system_account: boolean | null }>;
}) {
  return {
    from: jest.fn((table: string) => {
      const chain: Record<string, jest.Mock> = {};
      for (const method of ["select", "eq", "in", "gte", "or", "is"]) {
        chain[method] = jest.fn(() => chain);
      }
      const result = table === "alert_rules"
        ? { data: data.alerts, error: null }
        : table === "user_events"
          ? { data: data.events, error: null }
          : table === "sessions"
            ? { data: data.sessions, error: null }
            : { data: data.profiles, error: null };
      chain.then = jest.fn((resolve: (value: typeof result) => unknown) =>
        Promise.resolve(result).then(resolve));
      return chain;
    }),
  } as never;
}
