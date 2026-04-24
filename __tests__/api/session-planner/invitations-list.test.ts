/**
 * @jest-environment node
 */

import { GET } from "@/app/api/session-planner/invitations/route";
import {
  createMockSupabaseClient,
  createMockUser,
  createMockRequest,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
} from "@/test-utils/api-test-helpers";

// Mock the api-utils functions. Must include handleApiError + createAuthError
// because lib/middleware/api-wrappers (which wraps the route) imports them.
jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => {
    return new Response(
      JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }),
      { status }
    );
  }),
  createErrorResponse: jest.fn((error, details, status = 500) => {
    return new Response(
      JSON.stringify({
        success: false,
        error,
        details,
        timestamp: new Date().toISOString(),
      }),
      { status }
    );
  }),
  createAuthError: jest.fn((message = "Authentication required") => {
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      }),
      { status: 401 }
    );
  }),
  handleApiError: jest.fn((error: any, fallback?: string) => {
    return new Response(
      JSON.stringify({
        success: false,
        error: fallback ?? "Internal error",
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
      { status: 500 }
    );
  }),
  DEFAULT_SECURITY_HEADERS: {},
}));

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabaseClient),
}));

// Test data factories
function createMockInvitation(overrides = {}) {
  return {
    id: "invitation-123",
    session_id: "session-123",
    inviter_id: "inviter-456",
    invitee_id: "invitee-789",
    invitee_email: null,
    status: "pending",
    message: "Join me for a surf!",
    created_at: "2024-01-15T00:00:00Z",
    seen_at: null,
    ...overrides,
  };
}

function createMockSession(overrides = {}) {
  return {
    id: "session-123",
    beach_name: "Ocean Beach",
    arrival_time: "2024-01-20T10:00:00Z",
    ...overrides,
  };
}

function createMockProfile(overrides = {}) {
  return {
    id: "profile-123",
    full_name: "Test User",
    email: "test@example.com",
    avatar_url: "https://example.com/avatar.jpg",
    ...overrides,
  };
}

function createMockFollowing(overrides = {}) {
  return {
    following: {
      id: "friend-123",
      full_name: "Friend User",
      ...overrides,
    },
  };
}

describe("/api/session-planner/invitations - GET", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations"
      );

      const response = await GET(request);
      await expectErrorResponse(response, 401, "Authentication required");
    });

    it("should work with authenticated user", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations"
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Query Type Parameter", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should default to 'received' type", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.type).toBe("received");
    });

    it("should accept 'sent' type parameter", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.type).toBe("sent");
    });

    it("should accept 'received' type parameter", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "received" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.type).toBe("received");
    });

    it("should accept 'friends' type parameter", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "user_follows") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "friends" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe("Session ID Filter", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should filter invitations by sessionId when provided", async () => {
      const mockInvitations = [
        createMockInvitation({
          id: "invitation-1",
          session_id: "target-session",
        }),
        createMockInvitation({
          id: "invitation-2",
          session_id: "target-session",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession({ id: "target-session" })],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: {
            type: "sent",
            sessionId: "target-session",
          },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations).toHaveLength(2);
    });

    it("should return all invitations when no sessionId provided", async () => {
      const mockInvitations = [
        createMockInvitation({ id: "invitation-1", session_id: "session-1" }),
        createMockInvitation({ id: "invitation-2", session_id: "session-2" }),
        createMockInvitation({ id: "invitation-3", session_id: "session-3" }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [
                  createMockSession({ id: "session-1" }),
                  createMockSession({ id: "session-2" }),
                  createMockSession({ id: "session-3" }),
                ],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations).toHaveLength(3);
    });
  });

  describe("Sent Invitations", () => {
    beforeEach(() => {
      const mockUser = createMockUser({ id: "test-user-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should list pending invitations sent by user", async () => {
      const mockInvitations = [
        createMockInvitation({
          id: "invitation-1",
          inviter_id: "test-user-123",
          status: "pending",
        }),
        createMockInvitation({
          id: "invitation-2",
          inviter_id: "test-user-123",
          status: "pending",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession()],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.type).toBe("sent");
      expect(data.data.invitations).toHaveLength(2);
      expect(data.data.invitations[0]).toHaveProperty("status", "pending");
    });

    it("should include accepted invitations", async () => {
      const mockInvitations = [
        createMockInvitation({
          id: "invitation-1",
          inviter_id: "test-user-123",
          status: "accepted",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession()],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations[0].status).toBe("accepted");
    });

    it("should include declined invitations", async () => {
      const mockInvitations = [
        createMockInvitation({
          id: "invitation-1",
          inviter_id: "test-user-123",
          status: "declined",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession()],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations[0].status).toBe("declined");
    });

    it("should order sent invitations by created_at desc", async () => {
      const mockInvitations = [
        createMockInvitation({
          id: "invitation-3",
          created_at: "2024-01-20T00:00:00Z",
        }),
        createMockInvitation({
          id: "invitation-2",
          created_at: "2024-01-19T00:00:00Z",
        }),
        createMockInvitation({
          id: "invitation-1",
          created_at: "2024-01-18T00:00:00Z",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession()],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations[0].id).toBe("invitation-3");
      expect(data.data.invitations[2].id).toBe("invitation-1");
    });
  });

  describe("Received Invitations", () => {
    beforeEach(() => {
      const mockUser = createMockUser({
        id: "test-user-123",
        email: "test@example.com",
      });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should list pending invitations for user", async () => {
      const mockInvitations = [
        createMockInvitation({
          id: "invitation-1",
          invitee_id: "test-user-123",
          status: "pending",
        }),
        createMockInvitation({
          id: "invitation-2",
          invitee_id: "test-user-123",
          status: "pending",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession()],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "received" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.type).toBe("received");
      expect(data.data.invitations.length).toBeGreaterThan(0);
    });

    it("should list invitations by invitee_id", async () => {
      const mockInvitations = [
        createMockInvitation({
          id: "invitation-1",
          invitee_id: "test-user-123",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession()],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "received" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations.length).toBeGreaterThan(0);
    });

    it("should list invitations by invitee_email", async () => {
      const mockInvitations = [
        createMockInvitation({
          id: "invitation-1",
          invitee_id: null,
          invitee_email: "test@example.com",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession()],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "received" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations.length).toBeGreaterThan(0);
    });

    it("should deduplicate invitations by ID", async () => {
      const mockInvitationsById = [
        createMockInvitation({
          id: "invitation-1",
          invitee_id: "test-user-123",
        }),
      ];

      const mockInvitationsByEmail = [
        createMockInvitation({
          id: "invitation-1", // Duplicate
          invitee_email: "test@example.com",
        }),
        createMockInvitation({
          id: "invitation-2",
          invitee_email: "test@example.com",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitationsById,
                  error: null,
                }),
              })),
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitationsByEmail,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession()],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "received" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should have 2 unique invitations (deduplicated invitation-1)
      expect(data.data.invitations).toHaveLength(2);
    });
  });

  describe("Friends List", () => {
    beforeEach(() => {
      const mockUser = createMockUser({ id: "test-user-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should list user's friends (following)", async () => {
      const mockFollowing = [
        createMockFollowing({ id: "friend-1", full_name: "Friend One" }),
        createMockFollowing({ id: "friend-2", full_name: "Friend Two" }),
        createMockFollowing({ id: "friend-3", full_name: "Friend Three" }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "user_follows") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: mockFollowing,
                  error: null,
                }),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "friends" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(3);
    });

    it("should limit friends list to 50", async () => {
      const mockFollowing = Array.from({ length: 60 }, (_, i) =>
        createMockFollowing({ id: `friend-${i}`, full_name: `Friend ${i}` })
      );

      let limitValue: number | null = null;

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "user_follows") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                limit: jest.fn((limit: number) => {
                  limitValue = limit;
                  return Promise.resolve({
                    data: mockFollowing.slice(0, limit),
                    error: null,
                  });
                }),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "friends" },
        }
      );

      await GET(request);

      expect(limitValue).toBe(50);
    });

    it("should handle empty friends list", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "user_follows") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "friends" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
    });

    it("should filter out null following entries", async () => {
      const mockFollowing = [
        createMockFollowing({ id: "friend-1", full_name: "Friend One" }),
        { following: null },
        createMockFollowing({ id: "friend-2", full_name: "Friend Two" }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "user_follows") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: mockFollowing,
                  error: null,
                }),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "friends" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
    });
  });

  describe("Enriched Data", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should enrich invitations with session data", async () => {
      const mockInvitations = [
        createMockInvitation({ id: "invitation-1", session_id: "session-123" }),
      ];

      const mockSessions = [
        createMockSession({
          id: "session-123",
          beach_name: "Ocean Beach",
          arrival_time: "2024-01-20T10:00:00Z",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: mockSessions,
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockProfile()],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations[0].session).toEqual(
        expect.objectContaining({
          id: "session-123",
          beach_name: "Ocean Beach",
        })
      );
    });

    it("should enrich invitations with inviter data", async () => {
      const mockInvitations = [
        createMockInvitation({
          id: "invitation-1",
          inviter_id: "inviter-456",
        }),
      ];

      const mockProfiles = [
        createMockProfile({
          id: "inviter-456",
          full_name: "Inviter User",
          email: "inviter@example.com",
        }),
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [createMockSession()],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: mockProfiles,
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations[0].inviter).toEqual(
        expect.objectContaining({
          id: "inviter-456",
          full_name: "Inviter User",
        })
      );
    });
  });

  describe("Database Error Handling", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should handle error fetching sent invitations", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Database connection failed" },
                }),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500, "Failed to fetch invitations");
    });

    it("should handle error fetching received invitations by ID", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Query failed" },
                }),
              })),
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Query failed" },
                }),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "received" },
        }
      );

      const response = await GET(request);
      const data = await response.json();
      // Route gracefully handles received query errors (logs but continues with empty results)
      expect(response.status).toBe(200);
      expect(data.data.invitations).toEqual([]);
    });

    it("should handle error fetching friends list", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "user_follows") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Database error" },
                }),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "friends" },
        }
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500, "Failed to fetch friends");
    });
  });

  describe("Empty Results", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should return empty array when no sent invitations", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "sent" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations).toEqual([]);
    });

    it("should return empty array when no received invitations", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
              ilike: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/session-planner/invitations",
        {
          searchParams: { type: "received" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations).toEqual([]);
    });
  });
});
