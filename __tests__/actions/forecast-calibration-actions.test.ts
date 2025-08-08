import {
  getUserSessionSnapshots,
  getBeachSessionSnapshots,
  getBeachForecastAccuracy,
  getMultipleBeachAccuracy,
  createForecastSnapshot,
  updateBeachAccuracy,
  updateAllBeachAccuracy,
  getForecastAccuracyTrends,
  getUserForecastAccuracySummary,
} from "@/actions/forecast-calibration-actions";

// Mock the server utilities
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock("@/lib/server-action-utils", () => ({
  withAuthenticatedAction: jest.fn(),
  withDatabaseOperation: jest.fn(),
}));

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
};

const { createSupabaseServerClient } = require("@/lib/supabase/server");
const {
  withAuthenticatedAction,
  withDatabaseOperation,
} = require("@/lib/server-action-utils");

describe("Forecast Calibration Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createSupabaseServerClient.mockResolvedValue(mockSupabaseClient);
  });

  describe("getUserSessionSnapshots", () => {
    it("should fetch user session snapshots successfully", async () => {
      const mockSnapshots = [
        {
          id: "snapshot-1",
          session_id: "session-1",
          user_id: "user-1",
          beach_id: "beach-1",
          forecast_snapshot: { wave_height: "3-4 ft", confidence_score: 85 },
          actual_conditions: { wave_height: "3.5", rating: 4 },
          session_date: "2024-01-01",
          session: {
            id: "session-1",
            beach_name: "Test Beach",
            arrival_time: "2024-01-01T06:00:00Z",
            rating: 4,
            wave_height: "3.5",
            wave_quality: 4,
          },
        },
      ];

      // Mock the withAuthenticatedAction wrapper
      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        const result = await action(mockUser, mockSupabaseClient);
        return { success: true, data: result };
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockSnapshots,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await getUserSessionSnapshots(20, 0);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSnapshots);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "session_forecast_snapshots"
      );
    });

    it("should handle database errors", async () => {
      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        try {
          await action(mockUser, mockSupabaseClient);
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: null,
                error: { message: "Database connection failed" },
              }),
            }),
          }),
        }),
      });

      const result = await getUserSessionSnapshots();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database connection failed");
    });

    it("should use correct pagination parameters", async () => {
      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        const result = await action(mockUser, mockSupabaseClient);
        return { success: true, data: result };
      });

      const mockRange = jest.fn().mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: mockRange,
            }),
          }),
        }),
      });

      await getUserSessionSnapshots(10, 20);

      expect(mockRange).toHaveBeenCalledWith(20, 29); // offset 20, limit 10 -> range(20, 29)
    });
  });

  describe("getBeachSessionSnapshots", () => {
    it("should fetch beach session snapshots successfully", async () => {
      const mockSnapshots = [
        {
          id: "snapshot-1",
          beach_id: "beach-1",
          forecast_snapshot: { wave_height: "3-4 ft" },
          actual_conditions: { wave_height: "3.5" },
          user: { full_name: "Test User", avatar_url: null },
        },
      ];

      withDatabaseOperation.mockImplementation(async (operation) => {
        try {
          const result = await operation(mockSupabaseClient);
          if (result.error) {
            throw new Error(result.error.message);
          }
          // If result is the data array directly, return it. Otherwise extract data property.
          const data = Array.isArray(result) ? result : result.data || [];
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockSnapshots,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await getBeachSessionSnapshots("beach-1", 50);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSnapshots);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "session_forecast_snapshots"
      );
    });

    it("should handle missing beach data", async () => {
      withDatabaseOperation.mockImplementation(async (operation) => {
        try {
          const result = await operation(mockSupabaseClient);
          if (result.error) {
            throw new Error(result.error.message);
          }
          // If result is the data array directly, return it. Otherwise extract data property.
          const data = Array.isArray(result) ? result : result.data || [];
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await getBeachSessionSnapshots("nonexistent-beach");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("getBeachForecastAccuracy", () => {
    it("should fetch beach accuracy statistics successfully", async () => {
      const mockAccuracy = {
        id: "accuracy-1",
        beach_id: "beach-1",
        avg_wave_height_delta: 0.5,
        avg_wind_speed_delta: 2.1,
        total_sessions_count: 25,
        last_30_days_count: 8,
        overall_accuracy_score: 85.5,
        wave_height_accuracy: 88.2,
        wind_accuracy: 82.8,
      };

      withDatabaseOperation.mockImplementation(async (operation) => {
        try {
          const result = await operation(mockSupabaseClient);
          if (result.error) {
            throw new Error(result.error.message);
          }
          // If result is the data array directly, return it. Otherwise extract data property.
          const data = Array.isArray(result) ? result : result.data || [];
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockAccuracy,
              error: null,
            }),
          }),
        }),
      });

      const result = await getBeachForecastAccuracy("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAccuracy);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "beach_forecast_accuracy"
      );
    });

    it("should handle beach with no accuracy data", async () => {
      withDatabaseOperation.mockImplementation(async (operation) => {
        try {
          const result = await operation(mockSupabaseClient);
          if (result.error) {
            throw new Error(result.error.message);
          }
          // If result is the data array directly, return it. Otherwise extract data property.
          const data = Array.isArray(result) ? result : result.data || [];
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116", message: "No rows found" },
            }),
          }),
        }),
      });

      const result = await getBeachForecastAccuracy("new-beach");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No rows found");
    });
  });

  describe("getMultipleBeachAccuracy", () => {
    it("should fetch multiple beach accuracy statistics", async () => {
      const mockAccuracyData = [
        {
          id: "accuracy-1",
          beach_id: "beach-1",
          overall_accuracy_score: 85.5,
          beach: { name: "Test Beach 1", location_text: "San Diego, CA" },
        },
        {
          id: "accuracy-2",
          beach_id: "beach-2",
          overall_accuracy_score: 78.2,
          beach: { name: "Test Beach 2", location_text: "San Diego, CA" },
        },
      ];

      withDatabaseOperation.mockImplementation(async (operation) => {
        try {
          const result = await operation(mockSupabaseClient);
          if (result.error) {
            throw new Error(result.error.message);
          }
          // If result is the data array directly, return it. Otherwise extract data property.
          const data = Array.isArray(result) ? result : result.data || [];
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockAccuracyData,
              error: null,
            }),
          }),
        }),
      });

      const result = await getMultipleBeachAccuracy(["beach-1", "beach-2"]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAccuracyData);
      expect(result.data[0].overall_accuracy_score).toBeGreaterThan(
        result.data[1].overall_accuracy_score
      );
    });

    it("should handle empty beach ID array", async () => {
      withDatabaseOperation.mockImplementation(async (operation) => {
        try {
          const result = await operation(mockSupabaseClient);
          if (result.error) {
            throw new Error(result.error.message);
          }
          // If result is the data array directly, return it. Otherwise extract data property.
          const data = Array.isArray(result) ? result : result.data || [];
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await getMultipleBeachAccuracy([]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("createForecastSnapshot", () => {
    it("should create forecast snapshot successfully", async () => {
      const mockSession = {
        id: "session-1",
        user_id: "user-1",
        beach_id: "beach-1",
        arrival_time: "2024-01-01T06:00:00Z",
      };

      const mockSnapshot = {
        id: "snapshot-1",
        session_id: "session-1",
        user_id: "user-1",
        beach_id: "beach-1",
        forecast_snapshot: { wave_height: "3-4 ft", confidence_score: 85 },
        actual_conditions: { wave_height: "3.5", rating: 4 },
      };

      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        const result = await action(mockUser, mockSupabaseClient);
        return { success: true, data: result };
      });

      // Mock session lookup
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockSession,
                  error: null,
                }),
              }),
            }),
          }),
        })
        // Mock existing snapshot check
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: "PGRST116" }, // No rows found
              }),
            }),
          }),
        })
        // Mock snapshot creation
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSnapshot,
                error: null,
              }),
            }),
          }),
        });

      const forecastData = { wave_height: "3-4 ft", confidence_score: 85 };
      const actualData = { wave_height: "3.5", rating: 4 };

      const result = await createForecastSnapshot(
        "session-1",
        forecastData,
        actualData
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSnapshot);
    });

    it("should reject creation for non-owned session", async () => {
      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        try {
          await action(mockUser, mockSupabaseClient);
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: "Session not found" },
              }),
            }),
          }),
        }),
      });

      const result = await createForecastSnapshot("other-session", {}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Session not found");
    });

    it("should reject duplicate snapshot creation", async () => {
      const mockSession = {
        id: "session-1",
        user_id: "user-1",
        beach_id: "beach-1",
        arrival_time: "2024-01-01T06:00:00Z",
      };

      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        try {
          await action(mockUser, mockSupabaseClient);
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockSession,
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: "existing-snapshot" },
                error: null,
              }),
            }),
          }),
        });

      const result = await createForecastSnapshot("session-1", {}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });
  });

  describe("updateBeachAccuracy", () => {
    it("should update beach accuracy successfully", async () => {
      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        const result = await action(mockUser, mockSupabaseClient);
        return { success: true, data: result };
      });

      mockSupabaseClient.rpc.mockResolvedValue({ error: null });

      const result = await updateBeachAccuracy("beach-1");

      expect(result.success).toBe(true);
      expect(result.data.message).toContain("updated successfully");
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "update_beach_forecast_accuracy",
        {
          target_beach_id: "beach-1",
        }
      );
    });

    it("should handle RPC function errors", async () => {
      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        try {
          await action(mockUser, mockSupabaseClient);
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        error: { message: "Function not found" },
      });

      const result = await updateBeachAccuracy("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Function not found");
    });
  });

  describe("getUserForecastAccuracySummary", () => {
    it("should calculate user accuracy summary correctly", async () => {
      const mockSnapshots = [
        {
          forecast_snapshot: { wave_height: "3" },
          actual_conditions: { wave_height: "3.2" },
          session: { beach_name: "Beach A" },
        },
        {
          forecast_snapshot: { wave_height: "4" },
          actual_conditions: { wave_height: "3.8" },
          session: { beach_name: "Beach A" },
        },
        {
          forecast_snapshot: { wave_height: "2" },
          actual_conditions: { wave_height: "2.5" },
          session: { beach_name: "Beach B" },
        },
      ];

      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        const result = await action(mockUser, mockSupabaseClient);
        return { success: true, data: result };
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockSnapshots,
            error: null,
          }),
        }),
      });

      const result = await getUserForecastAccuracySummary();

      expect(result.success).toBe(true);
      expect(result.data.totalSessions).toBe(3);
      expect(result.data.avgAccuracy).toBeGreaterThan(0);
      expect(result.data.topBeaches).toHaveLength(2);
      expect(result.data.topBeaches[0].beachName).toBe("Beach A");
    });

    it("should handle user with no snapshots", async () => {
      withAuthenticatedAction.mockImplementation(async (action) => {
        const mockUser = { id: "user-1" };
        const result = await action(mockUser, mockSupabaseClient);
        return { success: true, data: result };
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await getUserForecastAccuracySummary();

      expect(result.success).toBe(true);
      expect(result.data.totalSessions).toBe(0);
      expect(result.data.avgAccuracy).toBe(0);
      expect(result.data.topBeaches).toEqual([]);
    });
  });

  describe("getForecastAccuracyTrends", () => {
    it("should fetch accuracy trends within date range", async () => {
      const mockTrendData = [
        {
          session_date: "2024-01-01",
          forecast_snapshot: { wave_height: "3" },
          actual_conditions: { wave_height: "3.2" },
          forecast_confidence_score: 85,
        },
        {
          session_date: "2024-01-02",
          forecast_snapshot: { wave_height: "4" },
          actual_conditions: { wave_height: "3.8" },
          forecast_confidence_score: 78,
        },
      ];

      withDatabaseOperation.mockImplementation(async (operation) => {
        try {
          const result = await operation(mockSupabaseClient);
          if (result.error) {
            throw new Error(result.error.message);
          }
          // If result is the data array directly, return it. Otherwise extract data property.
          const data = Array.isArray(result) ? result : result.data || [];
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockTrendData,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await getForecastAccuracyTrends("beach-1", 30);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTrendData);
      expect(result.data).toHaveLength(2);
    });

    it("should use correct date range filter", async () => {
      withDatabaseOperation.mockImplementation(async (operation) => {
        try {
          const result = await operation(mockSupabaseClient);
          if (result.error) {
            throw new Error(result.error.message);
          }
          // If result is the data array directly, return it. Otherwise extract data property.
          const data = Array.isArray(result) ? result : result.data || [];
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      const mockGte = jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: mockGte,
          }),
        }),
      });

      await getForecastAccuracyTrends("beach-1", 7);

      // Should filter for last 7 days
      expect(mockGte).toHaveBeenCalledWith("session_date", expect.any(String));
    });
  });
});
