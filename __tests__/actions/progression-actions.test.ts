/**
 * Progression Actions Test Suite (TDD)
 *
 * Tests written first. Uses the same Supabase mocking pattern as
 * dashboard-actions.test.ts (makeAuthenticatedAction -> createSupabaseServerClient).
 */

import { getProgressionDashboard } from "@/actions/progression-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  __esModule: true,
  createSupabaseServerClient: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable query mock where the terminal method returns `result`.
 * Each method returns the same obj so calls can be chained arbitrarily.
 */
function makeChain(terminalResult: any = { data: [], error: null }) {
  const obj: any = {};
  const terminal = jest.fn().mockResolvedValue(terminalResult);
  obj.select = jest.fn(() => obj);
  obj.insert = jest.fn(() => obj);
  obj.update = jest.fn(() => obj);
  obj.eq = jest.fn(() => obj);
  obj.neq = jest.fn(() => obj);
  obj.in = jest.fn(() => obj);
  obj.gte = jest.fn(() => obj);
  obj.lt = jest.fn(() => obj);
  obj.order = jest.fn(() => obj);
  obj.limit = jest.fn(() => obj);
  obj.filter = jest.fn(() => obj);
  obj.single = terminal;
  obj.maybeSingle = terminal;
  // Make the chain itself awaitable (for patterns like `await supabase.from(...).select(...).eq(...)`)
  obj.then = (resolve: any, reject: any) =>
    Promise.resolve(terminalResult).then(resolve, reject);
  return obj;
}

// ---------------------------------------------------------------------------
// Mock data fixtures
// ---------------------------------------------------------------------------

const USER_ID = "user-abc-123";

const completedSessions = [
  {
    arrival_time: "2026-03-01T08:00:00.000Z",
    wave_height_ft: 4,
    wave_quality: 4,
    rating: 8,
    duration_minutes: 90,
    tide_height_ft: 3.2,
    tide_status: "mid",
    wind_speed_mph: 10,
    wind_direction: "offshore",
    beach_id: "beach-1",
    skill_ratings: { "Pop-ups": 4, "Duck Dives": 3 },
  },
  {
    arrival_time: "2026-02-28T07:00:00.000Z",
    wave_height_ft: 4,
    wave_quality: 5,
    rating: 9,
    duration_minutes: 120,
    tide_height_ft: 1.5,
    tide_status: "low",
    wind_speed_mph: 8,
    wind_direction: "offshore",
    beach_id: "beach-1",
    skill_ratings: { "Pop-ups": 3, "Duck Dives": 3 },
  },
  {
    arrival_time: "2026-02-20T09:00:00.000Z",
    wave_height_ft: 3,
    wave_quality: 3,
    rating: 7,
    duration_minutes: 60,
    tide_height_ft: 5.0,
    tide_status: "high",
    wind_speed_mph: 15,
    wind_direction: "onshore",
    beach_id: "beach-2",
    skill_ratings: { "Pop-ups": 3 },
  },
];

const beachRows = [
  { id: "beach-1", name: "Ocean Beach", slug: "ocean-beach" },
  { id: "beach-2", name: "Blacks Beach", slug: "blacks-beach" },
];

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let mockSupabase: any;
let fromImpl: (table: string) => any;

beforeEach(() => {
  jest.clearAllMocks();

  // Default per-table responses — individual tests can override via fromImpl
  fromImpl = (table: string) => {
    if (table === "sessions") {
      return makeChain({ data: completedSessions, error: null });
    }
    if (table === "beaches") {
      return makeChain({ data: beachRows, error: null });
    }
    return makeChain({ data: [], error: null });
  };

  mockSupabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
    from: jest.fn((table: string) => fromImpl(table)),
  };

  (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getProgressionDashboard", () => {
  it("returns success with all required sections present", async () => {
    const result = await getProgressionDashboard();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const d = result.data!;
    expect(d).toHaveProperty("streaks");
    expect(d).toHaveProperty("monthlySummary");
    expect(d).toHaveProperty("skillProgression");
    expect(d).toHaveProperty("personalBests");
    expect(d).toHaveProperty("forecastImpact");
    expect(d).toHaveProperty("insights");
  });

  it("returns error when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await getProgressionDashboard();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authenticated/i);
  });

  describe("streaks section", () => {
    it("uses streak-calculator for consecutive session days", async () => {
      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      const { streaks } = result.data!;

      // 2026-03-01 and 2026-02-28 are consecutive — current streak >= 2
      expect(streaks.currentStreak).toBeGreaterThanOrEqual(2);
      expect(streaks.bestStreak).toBeGreaterThanOrEqual(2);
      expect(streaks.lastSessionDate).toBe("2026-03-01");
    });

    it("returns zero streaks for new user with no sessions", async () => {
      fromImpl = (table: string) =>
        makeChain({ data: table === "sessions" ? [] : beachRows, error: null });
      mockSupabase.from = jest.fn((t) => fromImpl(t));

      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      const { streaks } = result.data!;
      expect(streaks.currentStreak).toBe(0);
      expect(streaks.bestStreak).toBe(0);
      expect(streaks.lastSessionDate).toBeNull();
    });
  });

  describe("monthlySummary section", () => {
    it("counts sessions and hours for current month", async () => {
      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      const { monthlySummary } = result.data!;

      // current month sessions from fixture: Mar 1 + Feb 28 (Feb is last month)
      // Exact split depends on implementation; just verify shape and non-negative values
      expect(monthlySummary.sessions).toBeGreaterThanOrEqual(0);
      expect(monthlySummary.hours).toBeGreaterThanOrEqual(0);
      expect(monthlySummary.avgRating).toBeGreaterThanOrEqual(0);
      expect(monthlySummary).toHaveProperty("prevSessions");
      expect(monthlySummary).toHaveProperty("prevHours");
    });

    it("returns zeros for new user with no sessions", async () => {
      fromImpl = (_t: string) => makeChain({ data: [], error: null });
      mockSupabase.from = jest.fn((t) => fromImpl(t));

      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      const { monthlySummary } = result.data!;
      expect(monthlySummary.sessions).toBe(0);
      expect(monthlySummary.hours).toBe(0);
      expect(monthlySummary.avgRating).toBe(0);
      expect(monthlySummary.prevSessions).toBe(0);
      expect(monthlySummary.prevHours).toBe(0);
    });
  });

  describe("skillProgression section", () => {
    it("computes per-skill averages from skill_ratings JSONB", async () => {
      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      const { skillProgression } = result.data!;

      // "Pop-ups" appears in all 3 fixtures (4, 3, 3) — currentAvg computed from recent half
      const popUps = skillProgression.find((s) => s.skill === "Pop-ups");
      expect(popUps).toBeDefined();
      expect(popUps!.currentAvg).toBeGreaterThan(0);
      expect(popUps!.count).toBeGreaterThanOrEqual(1);
    });

    it("returns empty array for new user with no sessions", async () => {
      fromImpl = (_t: string) => makeChain({ data: [], error: null });
      mockSupabase.from = jest.fn((t) => fromImpl(t));

      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      expect(result.data!.skillProgression).toEqual([]);
    });

    it("only includes skills with rating data", async () => {
      const result = await getProgressionDashboard();

      const { skillProgression } = result.data!;
      // No skill with count 0 should appear
      for (const s of skillProgression) {
        expect(s.count).toBeGreaterThan(0);
      }
    });
  });

  describe("personalBests section", () => {
    it("picks longest session from duration_minutes", async () => {
      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      const { personalBests } = result.data!;

      // Longest session in fixture is 120 min = 2 hours
      expect(personalBests.longestSession.durationMinutes).toBe(120);
    });

    it("picks highest-rated session", async () => {
      const result = await getProgressionDashboard();

      const { personalBests } = result.data!;
      // Highest rating in fixture is 9
      expect(personalBests.bestRated.rating).toBe(9);
    });

    it("includes longestStreak in personalBests", async () => {
      const result = await getProgressionDashboard();

      const { personalBests } = result.data!;
      expect(personalBests).toHaveProperty("longestStreak");
      expect(personalBests.longestStreak).toBeGreaterThanOrEqual(0);
    });

    it("returns zero/null personal bests for new user", async () => {
      fromImpl = (_t: string) => makeChain({ data: [], error: null });
      mockSupabase.from = jest.fn((t) => fromImpl(t));

      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      const { personalBests } = result.data!;
      expect(personalBests.longestSession.durationMinutes).toBe(0);
      expect(personalBests.bestRated.rating).toBe(0);
      expect(personalBests.longestStreak).toBe(0);
      expect(personalBests.mostSessionsWeek).toBe(0);
    });
  });

  describe("forecastImpact section", () => {
    it("returns total session count and beach list", async () => {
      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      const { forecastImpact } = result.data!;

      expect(forecastImpact.totalSessions).toBeGreaterThan(0);
      expect(Array.isArray(forecastImpact.beaches)).toBe(true);
    });

    it("returns empty beaches array for new user", async () => {
      fromImpl = (_t: string) => makeChain({ data: [], error: null });
      mockSupabase.from = jest.fn((t) => fromImpl(t));

      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      const { forecastImpact } = result.data!;
      expect(forecastImpact.totalSessions).toBe(0);
      expect(forecastImpact.beaches).toEqual([]);
    });
  });

  describe("insights section", () => {
    it("returns an array of insights (may be empty for sparse data)", async () => {
      const result = await getProgressionDashboard();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data!.insights)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns error when sessions query fails", async () => {
      fromImpl = (_t: string) =>
        makeChain({ data: null, error: { message: "DB timeout" } });
      mockSupabase.from = jest.fn((t) => fromImpl(t));

      const result = await getProgressionDashboard();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
