import {
  getCalendarHeatmapData,
  getSessionAnalytics,
} from "@/lib/analytics/session-analytics";

function createSupabaseMock(data: unknown, error: unknown = null) {
  const query: Record<string, jest.Mock> = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.gte = jest.fn(() => query);
  query.lte = jest.fn(() => query);
  query.order = jest.fn(() => Promise.resolve({ data, error }));

  return {
    from: jest.fn(() => query),
  } as never;
}

describe("session analytics", () => {
  it("computes the API analytics result from completed sessions", async () => {
    const result = await getSessionAnalytics(
      createSupabaseMock([
        {
          id: "session-1",
          arrival_time: "2026-08-12T08:00:00.000Z",
          duration_minutes: 90,
          rating: 4,
          wave_quality: 3,
          water_temp: "62",
          crowd_level: 2,
          parking_ease: 4,
          beach_name: "Ocean Beach",
          beach: { name: "Ocean Beach" },
          board_id: "board-1",
          board: { name: "Midlength" },
        },
      ]),
      "user-1",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toMatchObject({
      type: "analytics",
      userId: "user-1",
      totalSessions: 1,
      completedSessions: 1,
      totalHours: 1.5,
      averageRating: 4,
      averageWaveHeight: 3,
      favoriteBeach: "Ocean Beach",
      frequentBoards: [
        { boardId: "board-1", boardName: "Midlength", usageCount: 1 },
      ],
      conditionRatings: {
        waterTemp: 62,
        crowdLevel: 2,
        waveQuality: 3,
        parkingEase: 4,
      },
    });
    expect(result.data.monthlyStats).toHaveLength(12);
    expect(result.data.waveHeightTrend).toEqual([
      { date: "Aug 12", averageWaveHeight: 3, sessionCount: 1 },
    ]);
  });

  it("builds one calendar entry per day and summarizes matching sessions", async () => {
    const result = await getCalendarHeatmapData(
      createSupabaseMock([
        {
          id: "session-1",
          arrival_time: "2026-08-12T08:00:00.000Z",
          rating: 4,
          wave_quality: 3,
          beach_name: "Ocean Beach",
          beach: { name: "Ocean Beach" },
        },
      ]),
      "user-1",
      2026,
      8,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(31);
    expect(result.data.find((day) => day.date === "2026-08-12")).toEqual({
      date: "2026-08-12",
      sessionCount: 1,
      averageWaveHeight: 3,
      averageRating: 4,
      sessions: [
        {
          id: "session-1",
          beachName: "Ocean Beach",
          rating: 4,
          waveHeight: 3,
        },
      ],
    });
  });
});
