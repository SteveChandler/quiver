import {
  getUserSessions,
  getUserSessionsByDateRange,
  getSessionById,
  getPublicSessions,
  updateSession,
  updateSessionForm,
  deleteSession,
  createLoggedSession,
  createPlannedSession,
  addBoard,
  uploadSessionMedia,
  getSessionsByBeach,
  getAllSessions,
  getPlannedSessionForConversion,
  updatePlannedSessionToCompleted,
} from "@/actions/session-actions";
import type { Session, SessionWithDetails, Board } from "@/types/database";
import type { SessionFormState } from "@/hooks/use-session-form";

// Mock Supabase client with flexible chaining
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
  rpc: jest.fn(),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
    })),
  },
};

// Helper function to create flexible mock chains for session actions
const createSessionMockChain = (finalResult: any) => {
  const chainMethods = {
    select: jest.fn(() => chainMethods),
    eq: jest.fn(() => chainMethods),
    order: jest.fn(() => chainMethods),
    limit: jest.fn(() => finalResult),
    single: jest.fn(() => finalResult),
    maybeSingle: jest.fn(() => finalResult),
    insert: jest.fn(() => chainMethods),
    update: jest.fn(() => chainMethods),
    delete: jest.fn(() => finalResult),
    gte: jest.fn(() => chainMethods),
    lte: jest.fn(() => chainMethods),
    ilike: jest.fn(() => chainMethods),
  };
  return chainMethods;
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() =>
    Promise.resolve(mockSupabaseClient)
  ),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("@/lib/utils/session-utils", () => ({
  transformSessionFormStateToDbSchema: jest.fn((data) => data),
  sanitizeSessionPayload: jest.fn((data) => data),
}));

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockSession: Session = {
  id: "session-123",
  user_id: "user-123",
  profile_id: "user-123",
  beach_id: "beach-123",
  beach_name: "Test Beach",
  board_id: "board-123",
  arrival_time: "2024-01-15T08:00:00.000Z",
  departure_time: "2024-01-15T10:00:00.000Z",
  duration_minutes: 120,
  wave_height: 6,
  wave_quality: 8,
  wind_speed: 10,
  wind_direction: "offshore",
  water_temp: "68°F",
  crowd_level: 3,
  rating: 9,
  notes: "Great session!",
  status: "completed",
  is_public: true,
  created_at: "2024-01-15T00:00:00.000Z",
  updated_at: "2024-01-15T00:00:00.000Z",
  likes_count: 5,
  comments_count: 2,
  parking_ease: 4,
};

const mockSessionWithDetails: SessionWithDetails = {
  ...mockSession,
  beach: {
    id: "beach-123",
    name: "Test Beach",
    latitude: 34.0522,
    longitude: -118.2437,
    state: "CA",
    country: "US",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    description: null,
    best_wind: null,
    best_swell: null,
    best_tide: null,
    break_type: null,
    experience_level: null,
    hazards: null,
    access_info: null,
    parking_info: null,
    facilities: null,
    season: null,
    crowd_factor: null,
    photo_url: null,
    msw_id: null,
  },
  board: {
    id: "board-123",
    user_id: "user-123",
    name: "Test Board",
    brand: "Test Brand",
    model: "Test Model",
    length: 6.2,
    width: 19.5,
    thickness: 2.5,
    volume: 35.0,
    board_type: "shortboard",
    notes: "Great board",
    session_count: 10,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  },
  user: {
    id: "user-123",
    full_name: "Test User",
    email: "test@example.com",
    phone_number: null,
    bio: null,
    avatar_url: "https://example.com/avatar.jpg",
    location: null,
    experience_level: null,
    favorite_spot: null,
    instagram: null,
    default_beach_id: null,
    notification_session_reminders: true,
    notification_community_replies: true,
    inapp_session_invites: true,
    email_session_invites: false,
    digest_session_invites: false,
    followers_count: 0,
    following_count: 0,
    is_mock: false,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  },
};

const mockBoard: Board = {
  id: "board-123",
  user_id: "user-123",
  name: "Test Board",
  brand: "Test Brand",
  model: "Test Model",
  length: 6.2,
  width: 19.5,
  thickness: 2.5,
  volume: 35.0,
  board_type: "shortboard",
  construction: "epoxy",
  notes: "Great board",
  is_active: true,
  session_count: 0,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

describe("Session Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe("getUserSessions", () => {
    it("should return user sessions successfully", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: [mockSessionWithDetails],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserSessions("user-123", 10);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSessionWithDetails]);
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("beach:beaches(*)"));
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockOrder).toHaveBeenCalledWith("arrival_time", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it("should work without limit parameter", async () => {
      const mockResult = Promise.resolve({
        data: [mockSessionWithDetails],
        error: null,
      });
      
      const mockChain = createSessionMockChain(mockResult);
      // Override order method to return the chain itself for unlimited queries
      mockChain.order = jest.fn(() => mockResult);
      
      mockSupabaseClient.from.mockReturnValue(mockChain);

      const result = await getUserSessions("user-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSessionWithDetails]);
    });

    it("should handle database errors with fallback", async () => {
      // First query fails
      const mockLimit = jest.fn().mockRejectedValue(new Error("Join failed"));

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      // Fallback query succeeds
      const mockFallbackLimit = jest.fn().mockResolvedValue({
        data: [mockSession],
        error: null,
      });

      const mockFallbackOrder = jest.fn().mockReturnValue({
        limit: mockFallbackLimit,
      });

      const mockFallbackEq = jest.fn().mockReturnValue({
        order: mockFallbackOrder,
      });

      const mockFallbackSelect = jest.fn().mockReturnValue({
        eq: mockFallbackEq,
      });

      // Mock beach lookup for fallback
      const mockBeachSingle = jest.fn().mockResolvedValue({
        data: mockSessionWithDetails.beach,
        error: null,
      });

      const mockBeachEq = jest.fn().mockReturnValue({
        single: mockBeachSingle,
      });

      const mockBeachSelect = jest.fn().mockReturnValue({
        eq: mockBeachEq,
      });

      // Mock user lookup for fallback
      const mockUserSingle = jest.fn().mockResolvedValue({
        data: { full_name: "Test User", avatar_url: "https://example.com/avatar.jpg" },
        error: null,
      });

      const mockUserEq = jest.fn().mockReturnValue({
        single: mockUserSingle,
      });

      const mockUserSelect = jest.fn().mockReturnValue({
        eq: mockUserEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockSelect }) // First failing query
        .mockReturnValueOnce({ select: mockFallbackSelect }) // Fallback basic query
        .mockReturnValueOnce({ select: mockBeachSelect }) // Beach lookup
        .mockReturnValueOnce({ select: mockUserSelect }); // User lookup

      const result = await getUserSessions("user-123", 10);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].beach).toEqual(mockSessionWithDetails.beach);
    });

  });

  describe("getUserSessionsByDateRange", () => {

  });

  describe("getSessionById", () => {
    it("should return session by ID", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockSessionWithDetails,
        error: null,
      });

      const mockEq2 = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getSessionById("session-123", "user-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSessionWithDetails);
      expect(mockEq1).toHaveBeenCalledWith("id", "session-123");
      expect(mockEq2).toHaveBeenCalledWith("user_id", "user-123");
    });

    it("should handle not found errors", async () => {
      const mockResult = Promise.resolve({
        data: null,
        error: new Error("Session not found"),
      });
      
      const mockChain = createSessionMockChain(mockResult);
      mockSupabaseClient.from.mockReturnValue(mockChain);

      const result = await getSessionById("session-123", "user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Session not found");
    });
  });

  describe("getPublicSessions", () => {
    it("should return public sessions", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: [mockSessionWithDetails],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getPublicSessions(5);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSessionWithDetails]);
      expect(mockEq).toHaveBeenCalledWith("is_public", true);
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it("should use default limit", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getPublicSessions();

      expect(result.success).toBe(true);
      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  describe("updateSession", () => {
    it("should update session successfully", async () => {
      const updateData = { wave_quality: 9, notes: "Updated notes" };

      // Mock getting current session
      const mockCurrentSingle = jest.fn().mockResolvedValue({
        data: { board_id: "board-123" },
        error: null,
      });

      const mockCurrentEq2 = jest.fn().mockReturnValue({
        single: mockCurrentSingle,
      });

      const mockCurrentEq1 = jest.fn().mockReturnValue({
        eq: mockCurrentEq2,
      });

      const mockCurrentSelect = jest.fn().mockReturnValue({
        eq: mockCurrentEq1,
      });

      // Mock update query
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: { ...mockSession, ...updateData },
        error: null,
      });

      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });

      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });

      const mockUpdateEq1 = jest.fn().mockReturnValue({
        eq: mockUpdateEq2,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockUpdateEq1,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockCurrentSelect })
        .mockReturnValueOnce({ update: mockUpdate });

      const result = await updateSession("session-123", "user-123", updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...mockSession, ...updateData });
      expect(mockUpdate).toHaveBeenCalledWith({
        ...updateData,
        updated_at: expect.any(String),
      });
    });

    it("should handle board_id changes with session count updates", async () => {
      const updateData = { board_id: "new-board-123" };

      // Mock getting current session with different board_id
      const mockCurrentSingle = jest.fn().mockResolvedValue({
        data: { board_id: "old-board-123" },
        error: null,
      });

      const mockCurrentEq2 = jest.fn().mockReturnValue({
        single: mockCurrentSingle,
      });

      const mockCurrentEq1 = jest.fn().mockReturnValue({
        eq: mockCurrentEq2,
      });

      const mockCurrentSelect = jest.fn().mockReturnValue({
        eq: mockCurrentEq1,
      });

      // Mock session update
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: { ...mockSession, ...updateData },
        error: null,
      });

      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });

      const mockSessionEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });

      const mockSessionEq1 = jest.fn().mockReturnValue({
        eq: mockSessionEq2,
      });

      const mockSessionUpdate = jest.fn().mockReturnValue({
        eq: mockSessionEq1,
      });

      // Mock board count updates
      const mockBoardEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockBoardEq1 = jest.fn().mockReturnValue({
        eq: mockBoardEq2,
      });

      const mockBoardUpdate = jest.fn().mockReturnValue({
        eq: mockBoardEq1,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockCurrentSelect }) // Get current session
        .mockReturnValueOnce({ update: mockSessionUpdate }) // Update session
        .mockReturnValueOnce({ update: mockBoardUpdate }) // Decrement old board
        .mockReturnValueOnce({ update: mockBoardUpdate }); // Increment new board

      // Mock RPC calls for increment/decrement
      mockSupabaseClient.rpc
        .mockReturnValueOnce("decrement-result")
        .mockReturnValueOnce("increment-result");

      const result = await updateSession("session-123", "user-123", updateData);

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("decrement", {
        row_id: "old-board-123",
      });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("increment", {
        row_id: "new-board-123",
      });
    });

  });

  describe("updateSessionForm", () => {
    it("should update session using authenticated wrapper", async () => {
      const updateData = { wave_quality: 8 };

      const mockSingle = jest.fn().mockResolvedValue({
        data: { ...mockSession, ...updateData },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq2 = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
      });

      const result = await updateSessionForm("session-123", updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...mockSession, ...updateData });
      expect(mockUpdate).toHaveBeenCalledWith(updateData);
      expect(mockEq1).toHaveBeenCalledWith("id", "session-123");
      expect(mockEq2).toHaveBeenCalledWith("user_id", mockUser.id);
    });

    it("should handle authentication errors", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const result = await updateSessionForm("session-123", { notes: "test" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication error: Not authenticated");
    });

    it("should handle update failures", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Update failed" },
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq2 = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
      });

      const result = await updateSessionForm("session-123", { notes: "test" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update session");
    });
  });

  describe("deleteSession", () => {
    it("should delete session successfully", async () => {
      // Mock getting session to check for board_id
      const mockFetchSingle = jest.fn().mockResolvedValue({
        data: { board_id: "board-123" },
        error: null,
      });

      const mockFetchEq2 = jest.fn().mockReturnValue({
        single: mockFetchSingle,
      });

      const mockFetchEq1 = jest.fn().mockReturnValue({
        eq: mockFetchEq2,
      });

      const mockFetchSelect = jest.fn().mockReturnValue({
        eq: mockFetchEq1,
      });

      // Mock delete operation
      const mockDeleteEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockDeleteEq1 = jest.fn().mockReturnValue({
        eq: mockDeleteEq2,
      });

      const mockDelete = jest.fn().mockReturnValue({
        eq: mockDeleteEq1,
      });

      // Mock board count decrement
      const mockBoardEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockBoardEq1 = jest.fn().mockReturnValue({
        eq: mockBoardEq2,
      });

      const mockBoardUpdate = jest.fn().mockReturnValue({
        eq: mockBoardEq1,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockFetchSelect })
        .mockReturnValueOnce({ delete: mockDelete })
        .mockReturnValueOnce({ update: mockBoardUpdate });

      mockSupabaseClient.rpc.mockReturnValue("decrement-result");

      const result = await deleteSession("session-123", "user-123");

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockDeleteEq1).toHaveBeenCalledWith("id", "session-123");
      expect(mockDeleteEq2).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("decrement", {
        row_id: "board-123",
      });
    });

    it("should handle sessions without board_id", async () => {
      // Mock getting session without board_id
      const mockFetchSingle = jest.fn().mockResolvedValue({
        data: { board_id: null },
        error: null,
      });

      const mockFetchEq2 = jest.fn().mockReturnValue({
        single: mockFetchSingle,
      });

      const mockFetchEq1 = jest.fn().mockReturnValue({
        eq: mockFetchEq2,
      });

      const mockFetchSelect = jest.fn().mockReturnValue({
        eq: mockFetchEq1,
      });

      // Mock delete operation
      const mockDeleteEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockDeleteEq1 = jest.fn().mockReturnValue({
        eq: mockDeleteEq2,
      });

      const mockDelete = jest.fn().mockReturnValue({
        eq: mockDeleteEq1,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockFetchSelect })
        .mockReturnValueOnce({ delete: mockDelete });

      const result = await deleteSession("session-123", "user-123");

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("should handle delete errors", async () => {
      const mockFetchSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Session not found" },
      });

      const mockFetchEq2 = jest.fn().mockReturnValue({
        single: mockFetchSingle,
      });

      const mockFetchEq1 = jest.fn().mockReturnValue({
        eq: mockFetchEq2,
      });

      const mockFetchSelect = jest.fn().mockReturnValue({
        eq: mockFetchEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockFetchSelect,
      });

      const result = await deleteSession("session-123", "user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Session not found");
    });
  });

  describe("createLoggedSession", () => {
    const mockSessionInput = {
      beach_id: "beach-123",
      beach_name: "Test Beach",
      arrival_time: "2024-01-15T08:00:00.000Z",
      wave_quality: 8,
      status: "completed" as const,
    };

    it("should create logged session successfully", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const result = await createLoggedSession(mockSessionInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSession);
      expect(mockInsert).toHaveBeenCalledWith({
        ...mockSessionInput,
        user_id: mockUser.id,
        profile_id: mockUser.id,
        status: "completed",
      });
    });

    it("should lookup beach by name when beach_id is missing", async () => {
      const inputWithoutId = {
        beach_name: "Test Beach",
        arrival_time: "2024-01-15T08:00:00.000Z",
        wave_quality: 8,
        status: "completed" as const,
      };

      // Mock beach lookup
      const mockBeachSingle = jest.fn().mockResolvedValue({
        data: { id: "found-beach-123" },
        error: null,
      });

      const mockBeachLimit = jest.fn().mockReturnValue({
        single: mockBeachSingle,
      });

      const mockBeachIlike = jest.fn().mockReturnValue({
        limit: mockBeachLimit,
      });

      const mockBeachSelect = jest.fn().mockReturnValue({
        ilike: mockBeachIlike,
      });

      // Mock session creation
      const mockSessionSingle = jest.fn().mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const mockSessionSelect = jest.fn().mockReturnValue({
        single: mockSessionSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockSessionSelect,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockBeachSelect }) // Beach lookup
        .mockReturnValueOnce({ insert: mockInsert }); // Session creation

      const result = await createLoggedSession(inputWithoutId);

      expect(result.success).toBe(true);
      expect(mockBeachIlike).toHaveBeenCalledWith("name", "Test Beach");
      expect(mockInsert).toHaveBeenCalledWith({
        ...inputWithoutId,
        beach_id: "found-beach-123",
        user_id: mockUser.id,
        profile_id: mockUser.id,
        status: "completed",
      });
    });

    it("should handle beach not found error", async () => {
      const inputWithoutId = {
        beach_name: "Nonexistent Beach",
        arrival_time: "2024-01-15T08:00:00.000Z",
        wave_quality: 8,
        status: "completed" as const,
      };

      // Mock beach lookup returning no results
      const mockBeachSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // No rows returned
      });

      const mockBeachLimit = jest.fn().mockReturnValue({
        single: mockBeachSingle,
      });

      const mockBeachIlike = jest.fn().mockReturnValue({
        limit: mockBeachLimit,
      });

      const mockBeachSelect = jest.fn().mockReturnValue({
        ilike: mockBeachIlike,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockBeachSelect,
      });

      const result = await createLoggedSession(inputWithoutId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Beach "Nonexistent Beach" not found. Please select a beach from the dropdown menu.');
    });

    it("should handle missing beach information", async () => {
      const inputWithoutBeach = {
        arrival_time: "2024-01-15T08:00:00.000Z",
        wave_quality: 8,
        status: "completed" as const,
      };

      const result = await createLoggedSession(inputWithoutBeach);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Please select a beach from the dropdown menu.");
    });

    it("should handle session creation errors", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Creation failed", details: "Constraint violation" },
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const result = await createLoggedSession(mockSessionInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Session creation failed: Creation failed");
    });

    it("should handle authentication errors", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const result = await createLoggedSession(mockSessionInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication error: Not authenticated");
    });
  });

  describe("createPlannedSession", () => {
    const mockSessionInput = {
      beach_id: "beach-123",
      beach_name: "Test Beach",
      arrival_time: "2024-01-15T08:00:00.000Z",
      status: "planned" as const,
    };

    it("should create planned session successfully", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: { ...mockSession, status: "planned" },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const result = await createPlannedSession(mockSessionInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...mockSession, status: "planned" });
      expect(mockInsert).toHaveBeenCalledWith({
        ...mockSessionInput,
        user_id: mockUser.id,
        profile_id: mockUser.id,
        status: "planned",
      });
    });

    it("should handle the same beach lookup logic as logged sessions", async () => {
      const inputWithoutId = {
        beach_name: "Test Beach",
        arrival_time: "2024-01-15T08:00:00.000Z",
        status: "planned" as const,
      };

      // Mock beach lookup
      const mockBeachSingle = jest.fn().mockResolvedValue({
        data: { id: "found-beach-123" },
        error: null,
      });

      const mockBeachLimit = jest.fn().mockReturnValue({
        single: mockBeachSingle,
      });

      const mockBeachIlike = jest.fn().mockReturnValue({
        limit: mockBeachLimit,
      });

      const mockBeachSelect = jest.fn().mockReturnValue({
        ilike: mockBeachIlike,
      });

      // Mock session creation
      const mockSessionSingle = jest.fn().mockResolvedValue({
        data: { ...mockSession, status: "planned" },
        error: null,
      });

      const mockSessionSelect = jest.fn().mockReturnValue({
        single: mockSessionSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockSessionSelect,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockBeachSelect })
        .mockReturnValueOnce({ insert: mockInsert });

      const result = await createPlannedSession(inputWithoutId);

      expect(result.success).toBe(true);
      expect(mockBeachIlike).toHaveBeenCalledWith("name", "Test Beach");
    });
  });

  describe("addBoard", () => {
    const mockBoardInput = {
      name: "Test Board",
      brand: "Test Brand",
      length: 6.2,
      board_type: "shortboard" as const,
    };

    it("should add board successfully", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockBoard,
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const result = await addBoard(mockBoardInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBoard);
      expect(mockInsert).toHaveBeenCalledWith({
        ...mockBoardInput,
        user_id: mockUser.id,
      });
    });

    it("should handle board creation errors", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Board creation failed" },
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const result = await addBoard(mockBoardInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to add board");
    });

    it("should handle authentication errors", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const result = await addBoard(mockBoardInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication error: Not authenticated");
    });
  });

  describe("getSessionsByBeach", () => {
    it("should return sessions for a specific beach", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: [mockSessionWithDetails],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq2 = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getSessionsByBeach("beach-123", 5);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSessionWithDetails]);
      expect(mockEq1).toHaveBeenCalledWith("beach_id", "beach-123");
      expect(mockEq2).toHaveBeenCalledWith("status", "completed");
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it("should use default limit", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq2 = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getSessionsByBeach("beach-123");

      expect(result.success).toBe(true);
      expect(mockLimit).toHaveBeenCalledWith(10);
    });

  });

  describe("updatePlannedSessionToCompleted", () => {
    const completedData = {
      duration_minutes: 120,
      wave_quality: 8,
      rating: 9,
      notes: "Great session!",
    };

    it("should update planned session to completed", async () => {
      // Mock fetching existing planned session
      const mockFetchSingle = jest.fn().mockResolvedValue({
        data: { id: "session-123", status: "planned", user_id: mockUser.id },
        error: null,
      });

      const mockFetchEq3 = jest.fn().mockReturnValue({
        single: mockFetchSingle,
      });

      const mockFetchEq2 = jest.fn().mockReturnValue({
        eq: mockFetchEq3,
      });

      const mockFetchEq1 = jest.fn().mockReturnValue({
        eq: mockFetchEq2,
      });

      const mockFetchSelect = jest.fn().mockReturnValue({
        eq: mockFetchEq1,
      });

      // Mock update operation
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: { ...mockSession, status: "completed", ...completedData },
        error: null,
      });

      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });

      const mockUpdateEq = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockUpdateEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockFetchSelect })
        .mockReturnValueOnce({ update: mockUpdate });

      const result = await updatePlannedSessionToCompleted("session-123", completedData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...mockSession, status: "completed", ...completedData });
      expect(mockFetchEq1).toHaveBeenCalledWith("id", "session-123");
      expect(mockFetchEq2).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(mockFetchEq3).toHaveBeenCalledWith("status", "planned");
      expect(mockUpdate).toHaveBeenCalledWith({
        status: "completed",
        ...completedData,
        updated_at: expect.any(String),
      });
    });

    it("should handle session not found", async () => {
      const mockFetchSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Session not found" },
      });

      const mockFetchEq3 = jest.fn().mockReturnValue({
        single: mockFetchSingle,
      });

      const mockFetchEq2 = jest.fn().mockReturnValue({
        eq: mockFetchEq3,
      });

      const mockFetchEq1 = jest.fn().mockReturnValue({
        eq: mockFetchEq2,
      });

      const mockFetchSelect = jest.fn().mockReturnValue({
        eq: mockFetchEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockFetchSelect,
      });

      const result = await updatePlannedSessionToCompleted("session-123", completedData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Planned session not found");
    });

    it("should handle update errors", async () => {
      // Mock successful fetch
      const mockFetchSingle = jest.fn().mockResolvedValue({
        data: { id: "session-123", status: "planned", user_id: mockUser.id },
        error: null,
      });

      const mockFetchEq3 = jest.fn().mockReturnValue({
        single: mockFetchSingle,
      });

      const mockFetchEq2 = jest.fn().mockReturnValue({
        eq: mockFetchEq3,
      });

      const mockFetchEq1 = jest.fn().mockReturnValue({
        eq: mockFetchEq2,
      });

      const mockFetchSelect = jest.fn().mockReturnValue({
        eq: mockFetchEq1,
      });

      // Mock failed update
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Update failed" },
      });

      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });

      const mockUpdateEq = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockUpdateEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockFetchSelect })
        .mockReturnValueOnce({ update: mockUpdate });

      const result = await updatePlannedSessionToCompleted("session-123", completedData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });
  });
});