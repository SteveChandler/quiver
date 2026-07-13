/**
 * Badge evaluation tests
 *
 * Tests getBadgeChecks() conditions for progression badges.
 * These tests operate on the pure constants function which requires
 * no mocking — just pass a UserBadgeStats object.
 */

import { getBadgeChecks } from "@/lib/gamification/constants";
import { evaluateBadgeUnlocks } from "@/lib/gamification/badge-service";
import type { UserBadgeStats } from "@/lib/gamification/types";

function makeStats(overrides: Partial<UserBadgeStats> = {}): UserBadgeStats {
  return {
    session_count: 0,
    board_count: 0,
    intel_posts: 0,
    group_sessions: 0,
    beach_reviews: 0,
    intel_likes: 0,
    invites_sent: 0,
    users_tagged: 0,
    early_sessions: 0,
    reflection_count: 0,
    swell_sessions: 0,
    consecutive_days: 0,
    board_tags: 0,
    temp_records: 0,
    wave_ratings: 0,
    complete_entries: 0,
    detailed_boards: 0,
    board_session_uses: 0,
    twin_fin_sessions: 0,
    skill_rated_sessions: 0,
    sweet_spot_confidence: 0,
    progression_shares: 0,
    distinct_beaches: 0,
    home_beach_sessions: 0,
    clean_condition_sessions: 0,
    five_star_sessions: 0,
    ...overrides,
  };
}

function getBadgeCondition(slug: string, stats: UserBadgeStats): boolean {
  const checks = getBadgeChecks(stats);
  const check = checks.find((c) => c.slug === slug);
  if (!check) throw new Error(`Badge slug "${slug}" not found in getBadgeChecks`);
  return check.condition;
}

describe("skill_tracker badge", () => {
  it("does not unlock when fewer than 10 sessions have skill ratings", () => {
    expect(getBadgeCondition("skill_tracker", makeStats({ skill_rated_sessions: 9 }))).toBe(false);
  });

  it("unlocks when exactly 10 sessions have skill ratings", () => {
    expect(getBadgeCondition("skill_tracker", makeStats({ skill_rated_sessions: 10 }))).toBe(true);
  });

  it("unlocks when more than 10 sessions have skill ratings", () => {
    expect(getBadgeCondition("skill_tracker", makeStats({ skill_rated_sessions: 25 }))).toBe(true);
  });

  it("does not unlock with 0 skill rated sessions", () => {
    expect(getBadgeCondition("skill_tracker", makeStats({ skill_rated_sessions: 0 }))).toBe(false);
  });
});

describe("streak_warrior badge", () => {
  it("does not unlock when best streak is below 14 days", () => {
    expect(getBadgeCondition("streak_warrior", makeStats({ consecutive_days: 13 }))).toBe(false);
  });

  it("unlocks when best streak is exactly 14 days", () => {
    expect(getBadgeCondition("streak_warrior", makeStats({ consecutive_days: 14 }))).toBe(true);
  });

  it("unlocks when best streak exceeds 14 days", () => {
    expect(getBadgeCondition("streak_warrior", makeStats({ consecutive_days: 30 }))).toBe(true);
  });

  it("does not unlock with 0 consecutive days", () => {
    expect(getBadgeCondition("streak_warrior", makeStats({ consecutive_days: 0 }))).toBe(false);
  });
});

describe("sweet_spot_finder badge", () => {
  it("does not unlock when confidence is exactly 0.5", () => {
    expect(getBadgeCondition("sweet_spot_finder", makeStats({ sweet_spot_confidence: 0.5 }))).toBe(false);
  });

  it("unlocks when confidence is above 0.5", () => {
    expect(getBadgeCondition("sweet_spot_finder", makeStats({ sweet_spot_confidence: 0.51 }))).toBe(true);
  });

  it("unlocks when confidence is 1.0", () => {
    expect(getBadgeCondition("sweet_spot_finder", makeStats({ sweet_spot_confidence: 1.0 }))).toBe(true);
  });

  it("does not unlock when confidence is 0", () => {
    expect(getBadgeCondition("sweet_spot_finder", makeStats({ sweet_spot_confidence: 0 }))).toBe(false);
  });

  it("does not unlock when confidence is 0.49", () => {
    expect(getBadgeCondition("sweet_spot_finder", makeStats({ sweet_spot_confidence: 0.49 }))).toBe(false);
  });
});

describe("progression_sharer badge", () => {
  it("does not unlock when no progression shares recorded", () => {
    expect(getBadgeCondition("progression_sharer", makeStats({ progression_shares: 0 }))).toBe(false);
  });

  it("unlocks after first progression share", () => {
    expect(getBadgeCondition("progression_sharer", makeStats({ progression_shares: 1 }))).toBe(true);
  });

  it("unlocks with multiple progression shares", () => {
    expect(getBadgeCondition("progression_sharer", makeStats({ progression_shares: 5 }))).toBe(true);
  });
});

describe("artwork badge set", () => {
  it.each([
    ["three_day_streak", { consecutive_days: 2 }, { consecutive_days: 3 }],
    ["new_break_logged", { distinct_beaches: 1 }, { distinct_beaches: 2 }],
    ["home_break_regular", { home_beach_sessions: 9 }, { home_beach_sessions: 10 }],
    ["clean_conditions", { clean_condition_sessions: 4 }, { clean_condition_sessions: 5 }],
    ["best_session", { five_star_sessions: 0 }, { five_star_sessions: 1 }],
  ] as const)("unlocks %s at its threshold", (slug, belowThreshold, atThreshold) => {
    expect(getBadgeCondition(slug, makeStats(belowThreshold))).toBe(false);
    expect(getBadgeCondition(slug, makeStats(atThreshold))).toBe(true);
  });
});

describe("artwork badge stat gathering", () => {
  it("awards every artwork badge when the corresponding session stats reach their thresholds", async () => {
    const userId = "user-123";
    const today = new Date();
    const arrivalTimes = [0, 1, 2].map((daysAgo) => {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - daysAgo);
      return { arrival_time: date.toISOString(), status: "completed" };
    });
    const definitions = [
      "three_day_streak",
      "new_break_logged",
      "home_break_regular",
      "clean_conditions",
      "best_session",
    ].map((badge_slug) => ({ badge_slug, name: badge_slug, icon: "Icon", xp_reward: 0 }));
    const sessionFilters: Array<{ method: string; column: string; value: unknown }> = [];

    const supabase = {
      from: jest.fn((table: string) => {
        const filters: Array<{ method: string; column: string; value: unknown }> = [];
        let columns = "";
        const result = (): { data: unknown[]; count?: number; error: null } => {
          if (table === "profiles") {
            return {
              data: [{ home_beach_id: "home-beach" }],
              error: null,
            };
          }
          if (table === "badge_definitions") return { data: definitions, error: null };
          if (table === "sessions" && columns === "beach_id") {
            return { data: [{ beach_id: "home-beach" }, { beach_id: "new-beach" }], error: null };
          }
          if (table === "sessions" && columns === "arrival_time,status") {
            return { data: arrivalTimes, error: null };
          }
          if (table === "sessions" && columns.includes("notes")) return { data: [], error: null };
          if (table === "sessions") {
            const count = filters.some((filter) => filter.method === "overlaps")
              ? 5
              : filters.some((filter) => filter.column === "rating" && filter.value === 5)
                ? 1
                : filters.some((filter) => filter.method === "in" && filter.column === "beach_id")
                  ? 10
                  : 0;
            return { data: [], count, error: null };
          }
          return { data: [], count: 0, error: null };
        };
        const query: any = {
          select: jest.fn((selectedColumns: string) => {
            columns = selectedColumns;
            return query;
          }),
          eq: jest.fn((column: string, value: unknown) => {
            filters.push({ method: "eq", column, value });
            if (table === "sessions") sessionFilters.push({ method: "eq", column, value });
            return query;
          }),
          not: jest.fn(() => query),
          or: jest.fn(() => query),
          overlaps: jest.fn((column: string, value: unknown) => {
            filters.push({ method: "overlaps", column, value });
            if (table === "sessions") sessionFilters.push({ method: "overlaps", column, value });
            return query;
          }),
          in: jest.fn((column: string, value: unknown) => {
            filters.push({ method: "in", column, value });
            if (table === "sessions") sessionFilters.push({ method: "in", column, value });
            return query;
          }),
          ilike: jest.fn(() => query),
          order: jest.fn(() => query),
          limit: jest.fn(() => query),
          maybeSingle: jest.fn(async () => {
            const value = result();
            return { data: value.data[0] ?? null, error: value.error };
          }),
          insert: jest.fn(async () => ({ data: null, error: null })),
          then: (onResolve: (value: { data: unknown[]; count?: number; error: null }) => unknown) =>
            Promise.resolve(onResolve(result())),
        };
        return query;
      }),
    };

    const badges = await evaluateBadgeUnlocks(userId, supabase as never);

    expect(badges.map((badge) => badge.badge_slug)).toEqual(expect.arrayContaining(definitions.map((badge) => badge.badge_slug)));
    expect(sessionFilters).toEqual(expect.arrayContaining([
      { method: "overlaps", column: "wave_characteristics", value: ["clean", "glassy"] },
      { method: "in", column: "beach_id", value: ["home-beach"] },
      { method: "eq", column: "rating", value: 5 },
    ]));
  });
});
