import { GET, PATCH } from "@/app/api/analytics/sessions/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSessionAnalytics,
  getCalendarHeatmapData,
} from "@/actions/analytics-actions";

// Mock dependencies
jest.mock("@/lib/supabase/server");
jest.mock("@/actions/analytics-actions");
jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn(
    (data, options) =>
      new Response(JSON.stringify(data), {
        status: options?.status || 200,
        headers: { "Content-Type": "application/json" },
      })
  ),
  handleApiError: jest.fn(
    (error) =>
      new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
  ),
}));

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

const mockAnalytics = {
  userId: "user-123",
  totalSessions: 5,
  completedSessions: 5,
  totalHours: 10.5,
  averageRating: 4.2,
  averageWaveHeight: 5.5,
  favoriteBeach: "Test Beach",
  frequentBoards: [],
  monthlyStats: [],
  waveHeightTrend: [],
  conditionRatings: {
    waterTemp: 68,
    crowdLevel: 3,
    windConditions: 2,
    waveQuality: 5,
    parkingEase: 4,
  },
  generatedAt: "2024-01-15T12:00:00Z",
};

const mockCalendarData = [
  {
    date: "2024-01-15",
    sessionCount: 1,
    averageWaveHeight: 6,
    averageRating: 4,
    sessions: [
      {
        id: "session-1",
        beachName: "Test Beach",
        rating: 4,
        waveHeight: 6,
      },
    ],
  },
];

describe("/api/analytics/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe("GET", () => {
    it("returns analytics data for authenticated user", async () => {
      (getSessionAnalytics as jest.Mock).mockResolvedValue({
        success: true,
        data: mockAnalytics,
      });

      const request = new Request(
        "http://localhost/api/analytics/sessions?userId=me&type=analytics"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.type).toBe("analytics");
      expect(data.userId).toBe("user-123");
      expect(data.totalSessions).toBe(5);
    });

    it("returns calendar data when type=calendar", async () => {
      (getCalendarHeatmapData as jest.Mock).mockResolvedValue({
        success: true,
        data: mockCalendarData,
      });

      const request = new Request(
        "http://localhost/api/analytics/sessions?userId=me&type=calendar&year=2024&month=1"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.type).toBe("calendar");
      expect(data.year).toBe(2024);
      expect(data.month).toBe(1);
      expect(data.data).toEqual(mockCalendarData);
    });

    it("requires authentication", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new Request(
        "http://localhost/api/analytics/sessions?userId=me&type=analytics"
      );
      const response = await GET(request);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Authentication required");
    });

    it("requires userId parameter", async () => {
      const request = new Request(
        "http://localhost/api/analytics/sessions?type=analytics"
      );
      const response = await GET(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("User ID is required");
    });

    it("prevents access to other users data", async () => {
      const request = new Request(
        "http://localhost/api/analytics/sessions?userId=other-user&type=analytics"
      );
      const response = await GET(request);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe("Unauthorized access to analytics data");
    });

    it("requires year and month for calendar type", async () => {
      const request = new Request(
        "http://localhost/api/analytics/sessions?userId=me&type=calendar"
      );
      const response = await GET(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Year and month are required for calendar data");
    });

    it("handles analytics action errors", async () => {
      (getSessionAnalytics as jest.Mock).mockResolvedValue({
        success: false,
        error: "Database error",
      });

      const request = new Request(
        "http://localhost/api/analytics/sessions?userId=me&type=analytics"
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it("handles calendar action errors", async () => {
      (getCalendarHeatmapData as jest.Mock).mockResolvedValue({
        success: false,
        error: "Database error",
      });

      const request = new Request(
        "http://localhost/api/analytics/sessions?userId=me&type=calendar&year=2024&month=1"
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it("defaults to analytics type when type parameter is missing", async () => {
      (getSessionAnalytics as jest.Mock).mockResolvedValue({
        success: true,
        data: mockAnalytics,
      });

      const request = new Request(
        "http://localhost/api/analytics/sessions?userId=me"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getSessionAnalytics).toHaveBeenCalledWith("user-123");
    });
  });

  describe("PATCH", () => {
    const mockSessionData = {
      id: "session-123",
      user_id: "user-123",
      is_public: false,
      updated_at: expect.any(String),
    };

    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: mockSessionData,
        error: null,
      });
    });

    it("updates session privacy successfully", async () => {
      const request = new Request("http://localhost/api/analytics/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-123",
          isPrivate: true,
        }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.message).toBe("Session privacy updated successfully");
      expect(data.session).toBeDefined();
    });

    it("requires authentication for privacy updates", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new Request("http://localhost/api/analytics/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-123",
          isPrivate: true,
        }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Authentication required");
    });

    it("requires sessionId and isPrivate parameters", async () => {
      const request = new Request("http://localhost/api/analytics/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-123",
          // Missing isPrivate
        }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Session ID and privacy flag are required");
    });

    it("validates isPrivate as boolean", async () => {
      const request = new Request("http://localhost/api/analytics/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-123",
          isPrivate: "true", // String instead of boolean
        }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Session ID and privacy flag are required");
    });

    it("handles database errors during update", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Session not found" },
      });

      const request = new Request("http://localhost/api/analytics/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-123",
          isPrivate: true,
        }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(500);
    });

    it("calls supabase update with correct parameters", async () => {
      const request = new Request("http://localhost/api/analytics/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-123",
          isPrivate: true,
        }),
      });

      await PATCH(request);

      expect(mockSupabase.from).toHaveBeenCalledWith("sessions");
      expect(mockSupabase.update).toHaveBeenCalledWith({
        is_public: false, // isPrivate: true -> is_public: false
        updated_at: expect.any(String),
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "session-123");
      expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-123");
    });

    it("correctly converts isPrivate to is_public", async () => {
      const request = new Request("http://localhost/api/analytics/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-123",
          isPrivate: false, // Should result in is_public: true
        }),
      });

      await PATCH(request);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        is_public: true, // isPrivate: false -> is_public: true
        updated_at: expect.any(String),
      });
    });
  });
});
