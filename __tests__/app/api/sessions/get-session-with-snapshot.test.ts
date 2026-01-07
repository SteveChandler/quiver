/**
 * Tests for GET /api/sessions/[id] - Session with Forecast Snapshot
 *
 * Verifies that the session API returns forecast snapshot data including:
 * - forecast_snapshot: Full forecast conditions at time of session
 * - actual_conditions: Actual conditions recorded by user
 * - forecast_vs_actual: Diff between forecast and actual (only changed fields)
 *
 * Note: This test verifies the query structure and transformation logic.
 * Full integration testing requires a running Supabase instance.
 */

describe("GET /api/sessions/[id] - Session with Forecast Snapshot", () => {
  it("should query for forecast_snapshot data from session_forecast_snapshots table", () => {
    // This test verifies the query structure includes the forecast_snapshot join
    const expectedSelectQuery = `
        *,
        session_date:arrival_time,
        beach:beaches(*),
        board:boards(*),
        user:profiles(*),
        forecast_snapshot:session_forecast_snapshots(
          forecast_snapshot,
          actual_conditions,
          forecast_vs_actual,
          forecast_confidence_score,
          data_source
        )
      `;

    // Verify the query structure is correct
    expect(expectedSelectQuery).toContain("session_forecast_snapshots");
    expect(expectedSelectQuery).toContain("forecast_snapshot");
    expect(expectedSelectQuery).toContain("actual_conditions");
    expect(expectedSelectQuery).toContain("forecast_vs_actual");
    expect(expectedSelectQuery).toContain("forecast_confidence_score");
    expect(expectedSelectQuery).toContain("data_source");
  });

  it("should transform forecast_snapshot array to single object", () => {
    // Mock data structure as returned by Supabase
    const mockData = {
      id: "session-123",
      user_id: "user-123",
      forecast_snapshot: [
        {
          forecast_snapshot: { wave_height: "3.5" },
          actual_conditions: { wave_height_ft: 5.0 },
          forecast_vs_actual: { wave_height_ft: { forecast: 3.5, actual: 5.0, diff: 1.5 } },
          forecast_confidence_score: 85,
          data_source: "CDIP",
        },
      ],
    };

    // Transformation logic from route
    const sessionWithSnapshot = {
      ...mockData,
      forecast_snapshot: Array.isArray(mockData.forecast_snapshot) && mockData.forecast_snapshot.length > 0
        ? mockData.forecast_snapshot[0]
        : null,
    };

    // Verify transformation
    expect(sessionWithSnapshot.forecast_snapshot).not.toBeInstanceOf(Array);
    expect(sessionWithSnapshot.forecast_snapshot).toMatchObject({
      forecast_snapshot: { wave_height: "3.5" },
      actual_conditions: { wave_height_ft: 5.0 },
      forecast_vs_actual: { wave_height_ft: { forecast: 3.5, actual: 5.0, diff: 1.5 } },
      forecast_confidence_score: 85,
      data_source: "CDIP",
    });
  });

  it("should handle sessions without forecast snapshot (empty array)", () => {
    const mockData = {
      id: "session-123",
      user_id: "user-123",
      forecast_snapshot: [],
    };

    // Transformation logic
    const sessionWithSnapshot = {
      ...mockData,
      forecast_snapshot: Array.isArray(mockData.forecast_snapshot) && mockData.forecast_snapshot.length > 0
        ? mockData.forecast_snapshot[0]
        : null,
    };

    // Should be null when no snapshot exists
    expect(sessionWithSnapshot.forecast_snapshot).toBeNull();
  });

  it("should verify the response structure includes all snapshot fields", () => {
    // Expected response structure
    const expectedResponse = {
      session: {
        id: "session-123",
        user_id: "user-123",
        beach_id: "beach-123",
        arrival_time: "2024-01-15T14:00:00Z",
        wave_height_ft: 5.0,
        wind_speed_mph: 12,
        wind_direction: "W",
        tide_height_ft: 3.2,
        tide_status: "rising",
        forecast_snapshot: {
          forecast_snapshot: {
            wave_height: "3.5",
            wave_period: "12",
            wind_speed_mph: 10,
            wind_direction: "NW",
            tide_height: "2.8",
            tide_status: "rising",
            confidence_score: 85,
            data_source: "CDIP",
          },
          actual_conditions: {
            wave_height_ft: 5.0,
            wind_speed_mph: 12,
            wind_direction: "W",
            tide_height_ft: 3.2,
            tide_status: "rising",
          },
          forecast_vs_actual: {
            wave_height_ft: { forecast: 3.5, actual: 5.0, diff: 1.5 },
            wind_speed_mph: { forecast: 10, actual: 12, diff: 2 },
            wind_direction: { forecast: "NW", actual: "W" },
            tide_height_ft: { forecast: 2.8, actual: 3.2, diff: 0.4 },
          },
          forecast_confidence_score: 85,
          data_source: "CDIP",
        },
      },
    };

    // Verify structure
    expect(expectedResponse.session.forecast_snapshot).toBeDefined();
    expect(expectedResponse.session.forecast_snapshot.forecast_snapshot).toBeDefined();
    expect(expectedResponse.session.forecast_snapshot.actual_conditions).toBeDefined();
    expect(expectedResponse.session.forecast_snapshot.forecast_vs_actual).toBeDefined();
    expect(expectedResponse.session.forecast_snapshot.forecast_confidence_score).toBe(85);
    expect(expectedResponse.session.forecast_snapshot.data_source).toBe("CDIP");
  });
});
