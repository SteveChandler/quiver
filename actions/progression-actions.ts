"use server";

import { makeAuthenticatedAction } from "@/lib/server-action-utils";
import { calculateStreak } from "@/lib/progression/streak-calculator";
import {
  generateInsights,
  type ProgressionData,
  type ProgressionInsight,
} from "@/lib/progression/insight-generator";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastSessionDate: string | null;
}

export interface MonthlySummary {
  sessions: number;
  hours: number;
  avgRating: number;
  prevSessions: number;
  prevHours: number;
}

export interface SkillTrend {
  skill: string;
  currentAvg: number;
  previousAvg: number;
  count: number;
}

export interface PersonalBests {
  longestSession: { durationMinutes: number; date: string | null };
  biggestWaves: { waveHeight: string | null; date: string | null };
  bestRated: { rating: number; date: string | null };
  mostSessionsWeek: number;
  longestStreak: number;
}

export interface BeachImpact {
  name: string;
  slug: string;
  accuracy: number;
  prevAccuracy: number | null;
  userSessions: number;
}

export interface ForecastImpact {
  totalSessions: number;
  conditionReports: number;
  beaches: BeachImpact[];
}

export interface ProgressionDashboardData {
  streaks: StreakData;
  monthlySummary: MonthlySummary;
  skillProgression: SkillTrend[];
  sweetSpot: ProgressionData["sweetSpot"];
  personalBests: PersonalBests;
  forecastImpact: ForecastImpact;
  insights: ProgressionInsight[];
}

// ---------------------------------------------------------------------------
// Session row shape (what we select from the DB)
// ---------------------------------------------------------------------------

interface SessionRow {
  arrival_time: string;
  wave_height_ft: number | null;
  wave_quality: number | null;
  rating: number | null;
  duration_minutes: number | null;
  tide_height_ft: number | null;
  tide_status: string | null;
  wind_speed_mph: number | null;
  wind_direction: string | null;
  beach_id: string | null;
  skill_ratings: Record<string, number> | null;
}

// ---------------------------------------------------------------------------
// Pure computation helpers (no I/O, easy to unit test)
// ---------------------------------------------------------------------------

function computeMonthlySummary(sessions: SessionRow[]): MonthlySummary {
  const now = new Date();
  const thisMonthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const prevMonthStart = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);

  const thisMonth = sessions.filter(
    (s) => new Date(s.arrival_time) >= thisMonthStart
  );
  const prevMonth = sessions.filter((s) => {
    const d = new Date(s.arrival_time);
    return d >= prevMonthStart && d < thisMonthStart;
  });

  const sumHours = (rows: SessionRow[]) =>
    rows.reduce((acc, s) => acc + (s.duration_minutes ?? 0) / 60, 0);

  const avgRating =
    thisMonth.length === 0
      ? 0
      : thisMonth.reduce((acc, s) => acc + (s.rating ?? 0), 0) /
        thisMonth.length;

  return {
    sessions: thisMonth.length,
    hours: Math.round(sumHours(thisMonth) * 10) / 10,
    avgRating: Math.round(avgRating * 10) / 10,
    prevSessions: prevMonth.length,
    prevHours: Math.round(sumHours(prevMonth) * 10) / 10,
  };
}

function computeSkillProgression(sessions: SessionRow[]): SkillTrend[] {
  // Split history in half: first half = "previous", second half = "current"
  const mid = Math.ceil(sessions.length / 2);
  const previous = sessions.slice(0, mid);
  const current = sessions.slice(mid);

  // Collect all skills across all sessions
  const allSkills = new Set<string>();
  for (const s of sessions) {
    for (const skill of Object.keys(s.skill_ratings ?? {})) {
      allSkills.add(skill);
    }
  }

  const trends: SkillTrend[] = [];

  for (const skill of allSkills) {
    const currentRatings = current
      .map((s) => s.skill_ratings?.[skill])
      .filter((v): v is number => v !== undefined);
    const previousRatings = previous
      .map((s) => s.skill_ratings?.[skill])
      .filter((v): v is number => v !== undefined);

    if (currentRatings.length === 0) continue;

    const avg = (arr: number[]) =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const currentAvg = Math.round(avg(currentRatings) * 10) / 10;
    const previousAvg = Math.round(avg(previousRatings) * 10) / 10;
    const count = currentRatings.length + previousRatings.length;

    trends.push({ skill, currentAvg, previousAvg, count });
  }

  return trends;
}

function computePersonalBests(
  sessions: SessionRow[],
  longestStreak: number
): PersonalBests {
  if (sessions.length === 0) {
    return {
      longestSession: { durationMinutes: 0, date: null },
      biggestWaves: { waveHeight: null, date: null },
      bestRated: { rating: 0, date: null },
      mostSessionsWeek: 0,
      longestStreak,
    };
  }

  // Longest session by duration
  const longestSessionRow = sessions.reduce((best, s) =>
    (s.duration_minutes ?? 0) > (best.duration_minutes ?? 0) ? s : best
  );

  // Biggest waves by wave_height_ft
  const biggestWaveRow = sessions.reduce((best, s) =>
    (s.wave_height_ft ?? 0) > (best.wave_height_ft ?? 0) ? s : best
  );

  // Best rated session
  const bestRatedRow = sessions.reduce((best, s) =>
    (s.rating ?? 0) > (best.rating ?? 0) ? s : best
  );

  // Most sessions in a single calendar week (Sun-Sat ISO weeks)
  const weekCounts: Record<string, number> = {};
  for (const s of sessions) {
    const d = new Date(s.arrival_time);
    // Use ISO week key: year + week number
    const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(
      ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
    );
    const key = `${d.getUTCFullYear()}-W${week}`;
    weekCounts[key] = (weekCounts[key] ?? 0) + 1;
  }
  const mostSessionsWeek = Math.max(0, ...Object.values(weekCounts));

  return {
    longestSession: {
      durationMinutes: longestSessionRow.duration_minutes ?? 0,
      date: longestSessionRow.arrival_time.slice(0, 10),
    },
    biggestWaves: {
      waveHeight: biggestWaveRow.wave_height_ft != null ? `${biggestWaveRow.wave_height_ft}ft` : null,
      date: biggestWaveRow.arrival_time.slice(0, 10),
    },
    bestRated: {
      rating: bestRatedRow.rating ?? 0,
      date: bestRatedRow.arrival_time.slice(0, 10),
    },
    mostSessionsWeek,
    longestStreak,
  };
}

function computeForecastImpact(
  sessions: SessionRow[],
  beaches: Array<{ id: string; name: string; slug: string }>
): ForecastImpact {
  if (sessions.length === 0) {
    return { totalSessions: 0, conditionReports: 0, beaches: [] };
  }

  // Count sessions per beach
  const beachSessionCounts: Record<string, number> = {};
  let conditionReports = 0;
  for (const s of sessions) {
    if (!s.beach_id) continue;
    beachSessionCounts[s.beach_id] = (beachSessionCounts[s.beach_id] ?? 0) + 1;
    if (s.wave_quality !== null) conditionReports++;
  }

  const beachLookup = new Map(beaches.map((b) => [b.id, b]));

  const beachList: BeachImpact[] = Object.entries(beachSessionCounts)
    .filter(([id]) => beachLookup.has(id))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => {
      const beach = beachLookup.get(id)!;
      return {
        name: beach.name,
        slug: beach.slug,
        accuracy: 0, // Populated from ml_accuracy data when available
        prevAccuracy: null,
        userSessions: count,
      };
    });

  return {
    totalSessions: sessions.length,
    conditionReports,
    beaches: beachList,
  };
}

function computeSweetSpot(
  sessions: SessionRow[]
): ProgressionData["sweetSpot"] {
  // Find the condition combination correlated with the highest ratings
  const rated = sessions.filter((s) => s.rating !== null && s.wave_height_ft != null);
  if (rated.length < 3) return null;

  // Group by wave_height_ft + wind_direction
  const groups: Record<
    string,
    { ratings: number[]; tide: string; wind: string; waveHeight: string }
  > = {};
  for (const s of rated) {
    const heightLabel = `${s.wave_height_ft}ft`;
    const key = `${heightLabel}|${s.wind_direction ?? "unknown"}`;
    if (!groups[key]) {
      groups[key] = {
        ratings: [],
        tide: s.tide_status ?? "unknown",
        wind: s.wind_direction ?? "unknown",
        waveHeight: heightLabel,
      };
    }
    groups[key].ratings.push(s.rating!);
  }

  const overallAvg =
    rated.reduce((acc, s) => acc + s.rating!, 0) / rated.length;

  let bestGroup: { key: string; avg: number; confidence: number } | null = null;
  for (const [key, g] of Object.entries(groups)) {
    if (g.ratings.length < 2) continue;
    const avg = g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length;
    const confidence = overallAvg > 0 ? (avg - overallAvg) / overallAvg : 0;
    if (!bestGroup || avg > bestGroup.avg) {
      bestGroup = { key, avg, confidence };
    }
  }

  if (!bestGroup) return null;

  const g = groups[bestGroup.key];
  return {
    waveHeight: g.waveHeight,
    tide: g.tide,
    wind: g.wind,
    confidence: Math.min(bestGroup.confidence, 1),
  };
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export const getProgressionDashboard = makeAuthenticatedAction(
  async (user, supabase) => {
    // Single query: all completed sessions with relevant fields
    const { data: rawSessions, error: sessionsError } = await supabase
      .from("sessions")
      .select(
        "arrival_time, wave_height_ft, wave_quality, rating, duration_minutes, tide_height_ft, tide_status, wind_speed_mph, wind_direction, beach_id, skill_ratings"
      )
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("arrival_time", { ascending: true });

    if (sessionsError) {
      throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    const sessions: SessionRow[] = (rawSessions ?? []).filter(
      (s: Record<string, unknown>): s is SessionRow => s?.arrival_time != null
    );

    // Streak
    const today = new Date().toISOString().slice(0, 10);
    const streaks = calculateStreak(
      sessions.map((s) => s.arrival_time),
      today
    );

    // Monthly summary
    const monthlySummary = computeMonthlySummary(sessions);

    // Skill progression from JSONB
    const skillProgression = computeSkillProgression(sessions);

    // Personal bests
    const personalBests = computePersonalBests(sessions, streaks.bestStreak);

    // Sweet spot
    const sweetSpot = computeSweetSpot(sessions);

    // Beach lookup for forecastImpact (only if we have sessions with beach_ids)
    const beachIds = [
      ...new Set(sessions.map((s) => s.beach_id).filter(Boolean)),
    ] as string[];

    let beaches: Array<{ id: string; name: string; slug: string }> = [];
    if (beachIds.length > 0) {
      const { data: beachData } = await supabase
        .from("beaches")
        .select("id, name, slug")
        .in("id", beachIds);
      beaches = (beachData ?? []) as Array<{
        id: string;
        name: string;
        slug: string;
      }>;
    }

    const forecastImpact = computeForecastImpact(sessions, beaches);

    // Insights
    const progressionData: ProgressionData = {
      skillTrends: skillProgression,
      forecastAccuracy: null, // Future: pull from ml_accuracy table
      sweetSpot,
      sessionCount: sessions.length,
      totalHours: sessions.reduce(
        (acc, s) => acc + (s.duration_minutes ?? 0) / 60,
        0
      ),
    };
    const insights = generateInsights(progressionData);

    const result: ProgressionDashboardData = {
      streaks,
      monthlySummary,
      skillProgression,
      sweetSpot,
      personalBests,
      forecastImpact,
      insights,
    };

    return result;
  }
);

export const recordProgressionShare = makeAuthenticatedAction(
  async (user, supabase) => {
    await supabase.from("xp_events").insert({
      user_id: user.id,
      action: "share_progression",
      xp_amount: 10,
      related_entity_type: "progression",
    });
    return { recorded: true };
  }
);
