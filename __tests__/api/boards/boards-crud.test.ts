/**
 * @jest-environment node
 */

/**
 * Tests for Boards CRUD API
 * Tests the GET and POST /api/boards endpoints for board management
 *
 * Critical coverage:
 * - GET: Lists user's boards with defensive filtering
 * - POST: Creates boards with validation
 * - PUT/PATCH/DELETE: Correctly return 405 Method Not Allowed
 * - Field validation (name, board_type, dimensions required)
 * - User isolation (RLS via user_id filtering)
 */

// Use lightweight NextRequest/NextResponse mock
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
import { NextRequest } from "next/server";

// Mock next/cache to avoid external dependencies
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// Mock createSupabaseServerClient before imports
const mockFrom = jest.fn();
const mockAuthGetUser = jest.fn();

const mockSupabaseClient = {
  auth: {
    getUser: mockAuthGetUser,
  },
  from: mockFrom,
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Import route handlers after mocks are set up
import { GET, POST, PUT, PATCH, DELETE } from "@/app/api/boards/route";

describe("Boards CRUD API", () => {
  const validUserId = "987fcdeb-51a2-43c1-a123-456789abcdef";
  const otherUserId = "111fcdeb-51a2-43c1-a123-456789abcd11";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // GET /api/boards - List user's boards
  // ============================================================================

  describe("GET /api/boards", () => {
    describe("Authentication", () => {
      it("requires authentication", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: { user: null },
          error: new Error("Not authenticated"),
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "GET",
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Authentication required");
      });
    });

    describe("Successful Listing", () => {
      it("lists user boards successfully", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const mockBoards = [
          {
            id: "board-1",
            user_id: validUserId,
            name: "My Shortboard",
            board_type: "shortboard",
            dimensions: "6'0\" x 18\" x 2.25\"",
            description: "Performance shortboard",
            image_url: "https://example.com/board1.jpg",
            size: "small",
            volume: 25.5,
            session_count: 10,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          {
            id: "board-2",
            user_id: validUserId,
            name: "Longboard",
            board_type: "longboard",
            dimensions: "9'6\" x 22\" x 3\"",
            description: null,
            image_url: null,
            size: null,
            volume: null,
            session_count: 5,
            created_at: "2024-01-02T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
        ];

        const mockOrder = jest.fn().mockResolvedValue({
          data: mockBoards,
          error: null,
        });
        const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

        mockFrom.mockReturnValue({
          select: mockSelect,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "GET",
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.boards).toHaveLength(2);
        expect(data.data.boards[0].name).toBe("My Shortboard");
        expect(data.data.boards[1].name).toBe("Longboard");

        // Verify RLS filtering by user_id
        expect(mockEq).toHaveBeenCalledWith("user_id", validUserId);
        expect(mockOrder).toHaveBeenCalledWith("updated_at", { ascending: false });
      });

      it("returns empty array when user has no boards", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const mockOrder = jest.fn().mockResolvedValue({
          data: [],
          error: null,
        });
        const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

        mockFrom.mockReturnValue({
          select: mockSelect,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "GET",
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.boards).toEqual([]);
      });

      it("filters out boards with empty required fields (defensive)", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        // Legacy data may contain empty/whitespace-only required strings
        const mockBoardsWithInvalid = [
          {
            id: "board-valid",
            user_id: validUserId,
            name: "Valid Board",
            board_type: "shortboard",
            dimensions: "6'0\" x 18\" x 2.25\"",
            session_count: 5,
          },
          {
            id: "board-empty-name",
            user_id: validUserId,
            name: "",
            board_type: "longboard",
            dimensions: "9'0\" x 22\" x 3\"",
            session_count: 2,
          },
          {
            id: "board-whitespace-type",
            user_id: validUserId,
            name: "Another Board",
            board_type: "   ",
            dimensions: "7'0\" x 20\" x 2.5\"",
            session_count: 3,
          },
          {
            id: "board-empty-dimensions",
            user_id: validUserId,
            name: "Yet Another",
            board_type: "funboard",
            dimensions: "",
            session_count: 1,
          },
        ];

        const mockOrder = jest.fn().mockResolvedValue({
          data: mockBoardsWithInvalid,
          error: null,
        });
        const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

        mockFrom.mockReturnValue({
          select: mockSelect,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "GET",
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        // Only the valid board should be returned
        expect(data.data.boards).toHaveLength(1);
        expect(data.data.boards[0].id).toBe("board-valid");
      });
    });

    describe("Error Handling", () => {
      it("handles database errors gracefully", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const mockOrder = jest.fn().mockResolvedValue({
          data: null,
          error: new Error("Database connection failed"),
        });
        const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

        mockFrom.mockReturnValue({
          select: mockSelect,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "GET",
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Error loading boards");
      });
    });
  });

  // ============================================================================
  // POST /api/boards - Create a new board
  // ============================================================================

  describe("POST /api/boards", () => {
    const validBoardData = {
      name: "My New Board",
      board_type: "shortboard",
      dimensions: "6'0\" x 18\" x 2.25\"",
      description: "A great performance board",
      image_url: "https://example.com/board.jpg",
      size: "small",
      volume: 25.5,
    };

    describe("Authentication", () => {
      it("requires authentication", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: { user: null },
          error: new Error("Not authenticated"),
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBoardData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Authentication required");
      });
    });

    describe("Content-Type Validation", () => {
      it("rejects requests without Content-Type header", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          body: JSON.stringify(validBoardData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Content-Type");
      });

      it("rejects requests with invalid Content-Type", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "not json",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Content-Type");
      });
    });

    describe("Field Validation", () => {
      it("validates board fields", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          // Missing required fields: name, board_type, dimensions
          description: "A board without required fields",
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects empty board name", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          name: "",
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects whitespace-only board name", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          name: "   ",
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects board name exceeding max length", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          name: "a".repeat(101), // Max is 100
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects empty board_type", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          board_type: "",
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects board_type exceeding max length", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          board_type: "a".repeat(51), // Max is 50
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects empty dimensions", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          dimensions: "",
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects dimensions exceeding max length", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          dimensions: "a".repeat(101), // Max is 100
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects description exceeding max length", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          description: "a".repeat(1001), // Max is 1000
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects invalid image_url", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          image_url: "not-a-url",
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects negative volume", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          volume: -5,
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("rejects unrealistic volume (>500)", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const invalidData = {
          ...validBoardData,
          volume: 501,
        };

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it("trims whitespace from string fields", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const dataWithWhitespace = {
          name: "  My Board  ",
          board_type: "  shortboard  ",
          dimensions: "  6'0\" x 18\" x 2.25\"  ",
          description: "  Great board  ",
          size: "  small  ",
        };

        const createdBoard = {
          id: "board-123",
          user_id: validUserId,
          name: "My Board", // Trimmed
          board_type: "shortboard", // Trimmed
          dimensions: "6'0\" x 18\" x 2.25\"", // Trimmed
          description: "Great board", // Trimmed
          size: "small", // Trimmed
          image_url: null,
          volume: null,
          session_count: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        const mockSingle = jest.fn().mockResolvedValue({
          data: createdBoard,
          error: null,
        });
        const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

        mockFrom.mockReturnValue({
          insert: mockInsert,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataWithWhitespace),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.name).toBe("My Board");
        expect(data.data.board_type).toBe("shortboard");
      });
    });

    describe("Successful Creation", () => {
      it("creates surfboard successfully with all fields", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const createdBoard = {
          id: "board-123",
          user_id: validUserId,
          ...validBoardData,
          session_count: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        const mockSingle = jest.fn().mockResolvedValue({
          data: createdBoard,
          error: null,
        });
        const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

        mockFrom.mockReturnValue({
          insert: mockInsert,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBoardData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.id).toBe("board-123");
        expect(data.data.name).toBe(validBoardData.name);
        expect(data.data.board_type).toBe(validBoardData.board_type);
        expect(data.data.dimensions).toBe(validBoardData.dimensions);
        expect(data.data.session_count).toBe(0);

        // Verify insert was called with correct data
        expect(mockInsert).toHaveBeenCalledWith({
          user_id: validUserId,
          name: validBoardData.name,
          board_type: validBoardData.board_type,
          dimensions: validBoardData.dimensions,
          description: validBoardData.description,
          image_url: validBoardData.image_url,
          size: validBoardData.size,
          volume: validBoardData.volume,
          session_count: 0,
        });
      });

      it("creates board with only required fields", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const minimalBoardData = {
          name: "Simple Board",
          board_type: "funboard",
          dimensions: "7'6\" x 21\" x 2.75\"",
        };

        const createdBoard = {
          id: "board-456",
          user_id: validUserId,
          ...minimalBoardData,
          description: null,
          image_url: null,
          size: null,
          volume: null,
          session_count: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        const mockSingle = jest.fn().mockResolvedValue({
          data: createdBoard,
          error: null,
        });
        const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

        mockFrom.mockReturnValue({
          insert: mockInsert,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(minimalBoardData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.name).toBe(minimalBoardData.name);
        expect(data.data.description).toBeNull();
        expect(data.data.image_url).toBeNull();
      });

      it("initializes session_count to 0", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const createdBoard = {
          id: "board-789",
          user_id: validUserId,
          name: "Test Board",
          board_type: "shortboard",
          dimensions: "6'2\" x 19\" x 2.4\"",
          session_count: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        const mockSingle = jest.fn().mockResolvedValue({
          data: createdBoard,
          error: null,
        });
        const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

        mockFrom.mockReturnValue({
          insert: mockInsert,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Board",
            board_type: "shortboard",
            dimensions: "6'2\" x 19\" x 2.4\"",
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.data.session_count).toBe(0);

        // Verify session_count was set in insert
        const insertCall = mockInsert.mock.calls[0][0];
        expect(insertCall.session_count).toBe(0);
      });

      it("associates board with authenticated user", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const createdBoard = {
          id: "board-abc",
          user_id: validUserId,
          name: "User Board",
          board_type: "longboard",
          dimensions: "9'0\" x 23\" x 3\"",
          session_count: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        const mockSingle = jest.fn().mockResolvedValue({
          data: createdBoard,
          error: null,
        });
        const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

        mockFrom.mockReturnValue({
          insert: mockInsert,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "User Board",
            board_type: "longboard",
            dimensions: "9'0\" x 23\" x 3\"",
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.data.user_id).toBe(validUserId);

        // Verify user_id was set in insert
        const insertCall = mockInsert.mock.calls[0][0];
        expect(insertCall.user_id).toBe(validUserId);
      });
    });

    describe("Error Handling", () => {
      it("handles database insertion errors gracefully", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const mockSingle = jest.fn().mockResolvedValue({
          data: null,
          error: new Error("Database constraint violation"),
        });
        const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

        mockFrom.mockReturnValue({
          insert: mockInsert,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBoardData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Error creating board");
      });

      it("handles malformed JSON gracefully", async () => {
        mockAuthGetUser.mockResolvedValue({
          data: {
            user: { id: validUserId, email: "user@example.com" },
          },
          error: null,
        });

        const request = new NextRequest("http://localhost:3000/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{invalid json",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Invalid JSON");
      });
    });
  });

  // ============================================================================
  // Unsupported HTTP Methods - Should return 405 Method Not Allowed
  // ============================================================================

  describe("Unsupported HTTP Methods", () => {
    it("PUT returns 405 Method Not Allowed", async () => {
      const response = await PUT();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Method [Nn]ot [Aa]llowed/);

      // Verify Allow header is set
      expect(response.headers.get("Allow")).toBe("GET, POST");
    });

    it("PATCH returns 405 Method Not Allowed", async () => {
      const response = await PATCH();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Method [Nn]ot [Aa]llowed/);

      // Verify Allow header is set
      expect(response.headers.get("Allow")).toBe("GET, POST");
    });

    it("DELETE returns 405 Method Not Allowed", async () => {
      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Method [Nn]ot [Aa]llowed/);

      // Verify Allow header is set
      expect(response.headers.get("Allow")).toBe("GET, POST");
    });
  });
});
