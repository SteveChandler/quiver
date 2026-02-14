// Test utilities for session planner features
import { jest } from "@jest/globals";

// Mock data for gear suggestions
export const mockBoardSuggestions = [
  {
    board: {
      id: "board-1",
      name: "Daily Driver",
      board_type: "Shortboard",
      dimensions: '6\'2" x 19" x 2.5"',
      description: "Perfect for everyday waves",
      image_url: null,
    },
    score: 85,
    confidence: 0.8,
    reasons: [
      "Good wave height (4ft)",
      "Recently used board",
      "High performance at this beach",
    ],
    matchedConditions: {
      waveHeight: 4,
      sessions: 12,
      averageRating: 4.2,
      lastUsed: "2024-01-15T10:00:00Z",
    },
  },
  {
    board: {
      id: "board-2",
      name: "Big Wave Gun",
      board_type: "Gun",
      dimensions: '7\'0" x 18" x 3"',
      description: "For serious waves",
      image_url: null,
    },
    score: 65,
    confidence: 0.6,
    reasons: [
      "Good performance in other conditions (4.1/5)",
      "Used in 8 sessions",
    ],
    matchedConditions: {
      waveHeight: 4,
      sessions: 8,
      averageRating: 4.1,
      lastUsed: "2024-01-10T08:00:00Z",
    },
  },
];

export const mockGearSuggestionsResponse = {
  success: true,
  data: {
    userId: "user-123",
    conditions: {
      waveHeight: 4,
      windSpeed: 8,
      beachId: "beach-456",
    },
    suggestions: mockBoardSuggestions,
    analysisResults: {
      totalSessions: 25,
      analyzedSessions: 15,
      recommendationBasis: "Historical session data",
    },
    generatedAt: "2024-01-16T12:00:00Z",
  },
};

// Mock data for optimal times
export const mockOptimalTimes = [
  {
    time: "06:00:00",
    score: 92,
    conditions: {
      waveHeight: 4.5,
      waveQuality: "Excellent",
      windSpeed: 5,
      windDirection: "NE",
      confidence: 85,
      weatherCondition: "Clear",
    },
    rating: "excellent" as const,
    reasons: [
      "Good wave height (4.5ft)",
      "Light winds (5mph)",
      "Offshore winds (NE)",
    ],
  },
  {
    time: "07:00:00",
    score: 88,
    conditions: {
      waveHeight: 4.2,
      waveQuality: "Good",
      windSpeed: 7,
      windDirection: "E",
      confidence: 80,
      weatherCondition: "Partly Cloudy",
    },
    rating: "good" as const,
    reasons: [
      "Good wave height (4.2ft)",
      "Moderate winds (7mph)",
      "Offshore winds (E)",
    ],
  },
];

export const mockOptimalTimesResponse = {
  success: true,
  data: {
    beachId: "beach-456",
    date: "2024-01-17",
    optimalTimes: mockOptimalTimes,
    forecastSource: "enhanced",
    generatedAt: "2024-01-16T12:00:00Z",
  },
};

// Mock data for invitations
export const mockFriends = [
  {
    id: "friend-1",
    full_name: "John Surfer",
    avatar_url: "/avatars/john.jpg",
    email: "john@example.com",
  },
  {
    id: "friend-2",
    full_name: "Sarah Wave",
    avatar_url: null,
    email: "sarah@example.com",
  },
];

export const mockInvitationsResponse = {
  success: true,
  data: {
    sessionId: "session-123",
    invitationsSent: 2,
    invitations: [
      {
        id: "invitation-1",
        sessionId: "session-123",
        inviterId: "user-123",
        inviteeId: "friend-1",
        inviteeEmail: "john@example.com",
        status: "pending",
        message: "Dawn patrol tomorrow!",
        createdAt: "2024-01-16T12:00:00Z",
      },
      {
        id: "invitation-2",
        sessionId: "session-123",
        inviterId: "user-123",
        inviteeId: "friend-2",
        inviteeEmail: "sarah@example.com",
        status: "pending",
        message: "Dawn patrol tomorrow!",
        createdAt: "2024-01-16T12:00:00Z",
      },
    ],
    errors: [],
  },
};

// Mock session form state
export const mockSessionFormState = {
  selectedBeach: "Ocean Beach",
  selectedBeachId: "beach-456",
  selectedDate: "2024-01-17",
  selectedTime: "06:00:00",
  boardId: "board-1",
  selectedBoard: "board-1",
  notes: "Looking forward to some good waves!",
  optimalTimes: mockOptimalTimes,
  selectedOptimalTime: "06:00:00",
  boardSuggestions: mockBoardSuggestions.map((s) => ({
    boardId: s.board.id,
    score: s.score,
    confidence: s.confidence,
    reasons: s.reasons,
  })),
  invitees: [
    { userId: "friend-1", email: "john@example.com", name: "John Surfer" },
    { email: "sarah@example.com", name: "Sarah Wave" },
  ],
  invitationMessage: "Dawn patrol tomorrow! Who's in? 🌅🏄‍♂️",
};

// Mock boards data
export const mockBoards = [
  {
    id: "board-1",
    name: "Daily Driver",
    board_type: "Shortboard",
    dimensions: '6\'2" x 19" x 2.5"',
    description: "Perfect for everyday waves",
    user_id: "user-123",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "board-2",
    name: "Big Wave Gun",
    board_type: "Gun",
    dimensions: '7\'0" x 18" x 3"',
    description: "For serious waves",
    user_id: "user-123",
    created_at: "2024-01-01T00:00:00Z",
  },
];

// Mock sessions data
export const mockSessions = [
  {
    id: "session-1",
    user_id: "user-123",
    board_id: "board-1",
    beach_id: "beach-456",
    status: "completed",
    rating: 4,
    wave_quality: 4,
    created_at: "2024-01-10T06:00:00Z",
    boards: mockBoards[0],
  },
  {
    id: "session-2",
    user_id: "user-123",
    board_id: "board-1",
    beach_id: "beach-456",
    status: "completed",
    rating: 5,
    wave_quality: 4,
    created_at: "2024-01-08T07:00:00Z",
    boards: mockBoards[0],
  },
];

// Mock forecasts data
export const mockForecasts = [
  {
    id: "forecast-1",
    beach_id: "beach-456",
    forecast_at: "2024-01-17T06:00:00Z",
    forecast_date: "2024-01-17",
    forecast_time: "06:00:00",
    wave_height: "4.5",
    wind_speed: "5mph",
    wind_direction: "NE",
    confidence_score: 0.85,
    weather_condition: "Clear",
    swell_period: 12,
    created_at: "2024-01-16T00:00:00Z",
  },
  {
    id: "forecast-2",
    beach_id: "beach-456",
    forecast_at: "2024-01-17T07:00:00Z",
    forecast_date: "2024-01-17",
    forecast_time: "07:00:00",
    wave_height: "4.2",
    wind_speed: "7mph",
    wind_direction: "E",
    confidence_score: 0.8,
    weather_condition: "Partly Cloudy",
    swell_period: 10,
    created_at: "2024-01-16T00:00:00Z",
  },
];

// Mock user data
export const mockUser = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: { full_name: "Test User" },
};

// Mock auth context
export const mockAuthContext = {
  user: mockUser,
  session: null,
  isLoading: false,
  isAuthenticated: false,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  refreshSession: jest.fn(),
};

// Mock useDataFetcher responses
export const createMockDataFetcherResponse = (
  data: any,
  loading = false,
  error: Error | null = null
) => ({
  data,
  loading,
  error,
  refetch: jest.fn(),
});

// Mock fetch responses
export const mockFetchSuccess = (data: any) => {
  (global.fetch as any) = jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  }));
};

export const mockFetchError = (error: string, status = 500) => {
  (global.fetch as any) = jest.fn(() => Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  }));
};

export const mockFetchNetworkError = () => {
  (global.fetch as any) = jest.fn(() => Promise.reject(new Error("Network error")));
};

// Mock Supabase client responses
export const mockSupabaseAuth = {
  getUser: jest.fn(() => Promise.resolve({
    data: { user: mockUser },
    error: null,
  })),
  getSession: jest.fn(() => Promise.resolve({
    data: { session: { user: mockUser } },
    error: null,
  })),
};

export const mockSupabaseSelect = (data: any, error: any = null) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(() => Promise.resolve({ data, error })),
  maybeSingle: jest.fn(() => Promise.resolve({ data, error })),
});

export const mockSupabaseInsert = (data: any, error: any = null) => ({
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(() => Promise.resolve({ data, error })),
});

export const mockSupabaseUpdate = (data: any, error: any = null) => ({
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(() => Promise.resolve({ data, error })),
});

export const mockSupabaseFrom = (
  tableName: string,
  data: any,
  error: any = null
) => {
  const mockMethods = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data, error })),
    maybeSingle: jest.fn(() => Promise.resolve({ data, error })),
  };

  return mockMethods;
};

// Test helper functions
export const createMockRequest = (
  searchParams: Record<string, string> = {}
): any => {
  const url = new URL("http://localhost:3000/api/test");
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  // Use browser-like headers so bot blocking middleware doesn't reject test requests.
  const req: any = new Request(url.toString(), {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
      "x-forwarded-for": "127.0.0.1",
    },
  });

  // Minimal NextRequest compatibility for middleware wrappers (rate limiting/bot blocking).
  req.nextUrl = new URL(req.url);
  return req;
};

export const createMockPostRequest = (body: any): any => {
  const req: any = new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
  req.nextUrl = new URL(req.url);
  return req;
};

export const createMockPatchRequest = (body: any): any => {
  const req: any = new Request("http://localhost:3000/api/test", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
  req.nextUrl = new URL(req.url);
  return req;
};

// Jest setup helpers
export const setupMockFetch = () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });
};

export const setupMockSupabase = () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
};

// Error simulation helpers
export const simulateAuthError = () => ({
  data: { user: null },
  error: new Error("Authentication required"),
});

export const simulateDatabaseError = () => ({
  data: null,
  error: new Error("Database connection failed"),
});

export const simulateValidationError = (message: string) => ({
  data: null,
  error: new Error(message),
});
