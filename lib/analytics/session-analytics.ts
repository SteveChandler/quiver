import type { SupabaseClient } from "@supabase/supabase-js";
import { eachDayOfInterval } from "date-fns/eachDayOfInterval";
import { endOfMonth } from "date-fns/endOfMonth";
import { format } from "date-fns/format";
import { startOfMonth } from "date-fns/startOfMonth";
import { subMonths } from "date-fns/subMonths";

/** Wave height trend data point */
interface WaveHeightTrendPoint {
  date: string;
  averageWaveHeight: number;
  sessionCount: number;
}

/** Monthly session statistics */
interface MonthlyStats {
  month: string;
  sessionCount: number;
  averageRating: number;
  totalHours: number;
}

/** Board usage statistics */
interface BoardUsage {
  boardId: string;
  boardName: string;
  usageCount: number;
}

/** Session analytics data structure */
interface SessionAnalytics {
  type: "analytics";
  userId: string;
  totalSessions: number;
  completedSessions: number;
  totalHours: number;
  averageRating: number;
  averageWaveHeight: number;
  favoriteBeach: string | null;
  frequentBoards: BoardUsage[];
  monthlyStats: MonthlyStats[];
  waveHeightTrend: WaveHeightTrendPoint[];
  conditionRatings: {
    waterTemp: number;
    crowdLevel: number;
    windConditions: number;
    waveQuality: number;
    parkingEase: number;
  };
  generatedAt: string;
}

/** Calendar day session summary */
interface CalendarDaySession {
  id: string;
  beachName: string;
  rating: number;
  waveHeight: number;
}

/** Calendar heatmap data point */
interface CalendarHeatmapData {
  date: string;
  sessionCount: number;
  averageWaveHeight: number;
  averageRating: number;
  sessions: CalendarDaySession[];
}

/**
 * Get comprehensive session analytics for a user
 * For use in API routes - pass authenticated supabase client and user ID
 */
export async function getSessionAnalytics(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: true; data: SessionAnalytics } | { success: false; error: string }> {
  try {

    // Get all completed sessions for the user
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(name),
        board:boards(name)
      `
      )
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("arrival_time", { ascending: false });

    if (sessionsError) {
      throw sessionsError;
    }

    const completedSessions = sessions || [];

    // Calculate basic statistics
    const totalSessions = completedSessions.length;
    const totalHours =
      completedSessions.reduce((sum, session) => {
        return sum + (session.duration_minutes || 0);
      }, 0) / 60;

    const averageRating =
      completedSessions.length > 0
        ? completedSessions.reduce(
            (sum, session) => sum + (session.rating || 0),
            0
          ) / completedSessions.length
        : 0;

    const averageWaveHeight =
      completedSessions.length > 0
        ? completedSessions.reduce(
            (sum, session) => sum + (session.wave_quality || 0),
            0
          ) / completedSessions.length
        : 0;

    // Find favorite beach
    const beachCounts = completedSessions.reduce((acc, session) => {
      const beachName =
        session.beach?.name || session.beach_name || "Unknown Beach";
      acc[beachName] = (acc[beachName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const favoriteBeach =
      Object.keys(beachCounts).length > 0
        ? (Object.entries(beachCounts) as [string, number][]).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
        : null;

    // Calculate frequent boards
    const boardCounts = completedSessions.reduce((acc, session) => {
      if (session.board?.name && session.board_id) {
        const key = session.board_id;
        acc[key] = {
          boardId: session.board_id,
          boardName: session.board.name,
          usageCount: (acc[key]?.usageCount || 0) + 1,
        };
      }
      return acc;
    }, {} as Record<string, { boardId: string; boardName: string; usageCount: number }>);

    const frequentBoards: BoardUsage[] = (Object.values(boardCounts) as BoardUsage[])
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    // Calculate monthly statistics (last 12 months)
    const monthlyStats = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));

      const monthSessions = completedSessions.filter((session) => {
        const sessionDate = new Date(session.arrival_time);
        return sessionDate >= monthStart && sessionDate <= monthEnd;
      });

      const monthHours =
        monthSessions.reduce((sum, session) => {
          return sum + (session.duration_minutes || 0);
        }, 0) / 60;

      const monthRating =
        monthSessions.length > 0
          ? monthSessions.reduce(
              (sum, session) => sum + (session.rating || 0),
              0
            ) / monthSessions.length
          : 0;

      monthlyStats.push({
        month: format(monthStart, "MMM yyyy"),
        sessionCount: monthSessions.length,
        averageRating: Math.round(monthRating * 10) / 10,
        totalHours: Math.round(monthHours * 10) / 10,
      });
    }

    // Calculate wave height trend (last 30 sessions)
    const recentSessions = completedSessions.slice(0, 30);
    const waveHeightTrend = recentSessions.reverse().map((session) => ({
      date: format(new Date(session.arrival_time), "MMM dd"),
      averageWaveHeight: session.wave_quality || 0,
      sessionCount: 1,
    }));

    // Calculate condition ratings
    const conditionRatings = {
      waterTemp:
        completedSessions.length > 0
          ? completedSessions.reduce((sum, session) => {
              const temp = session.water_temp
                ? parseFloat(session.water_temp)
                : 0;
              return sum + (temp > 0 ? temp : 65); // Default to 65°F if no temp
            }, 0) / completedSessions.length
          : 0,
      crowdLevel:
        completedSessions.length > 0
          ? completedSessions.reduce(
              (sum, session) => sum + (session.crowd_level || 0),
              0
            ) / completedSessions.length
          : 0,
      windConditions: 3.5, // Placeholder - would need wind data
      waveQuality: averageWaveHeight,
      parkingEase:
        completedSessions.length > 0
          ? completedSessions.reduce(
              (sum, session) => sum + (session.parking_ease || 0),
              0
            ) / completedSessions.length
          : 0,
    };

    const analytics: SessionAnalytics = {
      type: "analytics",
      userId,
      totalSessions: completedSessions.length,
      completedSessions: completedSessions.length,
      totalHours: Math.round(totalHours * 10) / 10,
      averageRating: Math.round(averageRating * 10) / 10,
      averageWaveHeight: Math.round(averageWaveHeight * 10) / 10,
      favoriteBeach,
      frequentBoards,
      monthlyStats,
      waveHeightTrend,
      conditionRatings: {
        waterTemp: Math.round(conditionRatings.waterTemp * 10) / 10,
        crowdLevel: Math.round(conditionRatings.crowdLevel * 10) / 10,
        windConditions: Math.round(conditionRatings.windConditions * 10) / 10,
        waveQuality: Math.round(conditionRatings.waveQuality * 10) / 10,
        parkingEase: Math.round(conditionRatings.parkingEase * 10) / 10,
      },
      generatedAt: new Date().toISOString(),
    };

    return { success: true, data: analytics };
  } catch (error) {
    console.error("Error getting session analytics:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get session analytics"
    };
  }
}

/**
 * Get calendar heatmap data for a specific month
 * For use in API routes - pass authenticated supabase client and parameters
 */
export async function getCalendarHeatmapData(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number
): Promise<{ success: true; data: CalendarHeatmapData[] } | { success: false; error: string }> {
  try {

    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));

    // Get all sessions for the month
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(name)
      `
      )
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("arrival_time", monthStart.toISOString())
      .lte("arrival_time", monthEnd.toISOString())
      .order("arrival_time", { ascending: true });

    if (error) {
      throw error;
    }

    // Group sessions by date
    const sessionsByDate = (sessions || []).reduce((acc, session) => {
      const date = format(new Date(session.arrival_time), "yyyy-MM-dd");
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(session);
      return acc;
    }, {} as Record<string, typeof sessions>);

    // Generate calendar data for each day of the month
    const calendarData: CalendarHeatmapData[] = [];
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    daysInMonth.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const daySessions = sessionsByDate[dateStr] || [];

      const averageWaveHeight =
        daySessions.length > 0
          ? daySessions.reduce(
              (sum: number, session: { wave_quality?: number | null }) => sum + (session.wave_quality || 0),
              0
            ) / daySessions.length
          : 0;

      const averageRating =
        daySessions.length > 0
          ? daySessions.reduce(
              (sum: number, session: { rating?: number | null }) => sum + (session.rating || 0),
              0
            ) / daySessions.length
          : 0;

      calendarData.push({
        date: dateStr,
        sessionCount: daySessions.length,
        averageWaveHeight: Math.round(averageWaveHeight * 10) / 10,
        averageRating: Math.round(averageRating * 10) / 10,
        sessions: daySessions.map((session: { id: string; beach?: { name?: string } | null; beach_name?: string | null; rating?: number | null; wave_quality?: number | null }) => ({
          id: session.id,
          beachName:
            session.beach?.name || session.beach_name || "Unknown Beach",
          rating: session.rating || 0,
          waveHeight: session.wave_quality || 0,
        })),
      });
    });

    return { success: true, data: calendarData };
  } catch (error) {
    console.error("Error getting calendar heatmap data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get calendar data"
    };
  }
}
