/**
 * Badge evaluation tests
 *
 * Tests getBadgeChecks() conditions for progression badges.
 * These tests operate on the pure constants function which requires
 * no mocking — just pass a UserBadgeStats object.
 */

import { getBadgeChecks } from "@/lib/gamification/constants";
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
