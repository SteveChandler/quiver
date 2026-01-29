/**
 * @jest-environment node
 */

import { POST } from "@/app/api/session-planner/invitations/route";
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

// Mock the api-utils functions
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
}));

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabaseClient),
}));

// Mock notification functions
jest.mock("@/lib/notifications", () => ({
  notifySessionInvite: jest.fn().mockResolvedValue("activity-123"),
}));

jest.mock("@/lib/mailer/sessionInviteEmail", () => ({
  sendSessionInviteEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/gamification-actions", () => ({
  trackXP: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/services/push-notifications", () => ({
  sendSessionInvitePush: jest.fn().mockResolvedValue(undefined),
}));

// Test data factories
function createMockSession(overrides = {}) {
  return {
    id: "session-123",
    user_id: "test-user-123",
    beach_name: "Ocean Beach",
    arrival_time: "2024-01-20T10:00:00Z",
    status: "planned",
    created_at: "2024-01-15T00:00:00Z",
    ...overrides,
  };
}

function createMockInvitation(overrides = {}) {
  return {
    id: "invitation-123",
    session_id: "session-123",
    inviter_id: "test-user-123",
    invitee_id: "invitee-456",
    invitee_email: null,
    status: "pending",
    message: "Join me for a surf!",
    created_at: "2024-01-15T00:00:00Z",
    seen_at: null,
    ...overrides,
  };
}

function createMockProfile(overrides = {}) {
  return {
    id: "profile-123",
    email: "invitee@example.com",
    full_name: "Invitee User",
    email_session_invites: true,
    inapp_session_invites: true,
    ...overrides,
  };
}

describe("/api/session-planner/invitations - POST", () => {
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
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      await expectErrorResponse(response, 401, "Authentication required");
    });

    it("should work with authenticated user", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      // Mock session query
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: mockUser.id }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({
                    data: createMockInvitation(),
                    error: null,
                  }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockProfile({
                    id: "invitee-456",
                    email: "invitee@example.com",
                    email_session_invites: true,
                    inapp_session_invites: true,
                  }),
                  error: null,
                }),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Input Validation", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should require sessionId", async () => {
      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      await expectErrorResponse(
        response,
        400,
        "Session ID and invitees are required"
      );
    });

    it("should require invitees array", async () => {
      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
          },
        }
      );

      const response = await POST(request);
      await expectErrorResponse(
        response,
        400,
        "Session ID and invitees are required"
      );
    });

    it("should require non-empty invitees array", async () => {
      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [],
          },
        }
      );

      const response = await POST(request);
      await expectErrorResponse(
        response,
        400,
        "Session ID and invitees are required"
      );
    });

    it("should accept valid request with userId", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      // Mock session and invitation queries
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        console.log("MOCK from() called with table:", table);
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: mockUser.id }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
              gt: jest.fn(() => ({
                order: jest.fn(() => ({
                  maybeSingle: jest
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({
                    data: createMockInvitation(),
                    error: null,
                  }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          const mockProfile = createMockProfile({
            id: "invitee-456",
            email: "invitee@example.com",
            email_session_invites: true,
            inapp_session_invites: true,
          });
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({
                data: [mockProfile],
                error: null
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
            message: "Join me!",
          },
        }
      );

      const response = await POST(request);
      if (response.status !== 200) {
        const data = await response.json();
        console.log("FAIL RESPONSE:", JSON.stringify(data, null, 2));
      }
      expect(response.status).toBe(200);
    });

    it("should accept valid request with email", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: mockUser.id }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
              gt: jest.fn(() => ({
                order: jest.fn(() => ({
                  maybeSingle: jest
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({
                    data: createMockInvitation({ invitee_email: "test@example.com" }),
                    error: null,
                  }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              ilike: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              })),
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockProfile({
                    email: "test@example.com",
                    email_session_invites: true,
                    inapp_session_invites: true,
                  }),
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ email: "test@example.com" }],
          },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Session Validation", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should reject invitation to non-existent session", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Session not found" },
                  }),
                })),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "nonexistent-session",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      await expectErrorResponse(
        response,
        404,
        "Session not found or access denied"
      );
    });

    it("should reject invitation to session user does not own", async () => {
      const mockUser = createMockUser({ id: "test-user-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "other-user-session",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      await expectErrorResponse(
        response,
        404,
        "Session not found or access denied"
      );
    });

    it("should reject invitation to completed session", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({
                        user_id: mockUser.id,
                        status: "completed",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "completed-session",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      await expectErrorResponse(
        response,
        400,
        "Can only invite friends to planned sessions"
      );
    });

    it("should accept invitation to planned session", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({
                        user_id: mockUser.id,
                        status: "planned",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
              gt: jest.fn(() => ({
                order: jest.fn(() => ({
                  maybeSingle: jest
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({
                    data: createMockInvitation(),
                    error: null,
                  }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          const mockProfile = createMockProfile({
                    id: "invitee-456",
                    email: "invitee@example.com",
                    email_session_invites: true,
                    inapp_session_invites: true,
                  });
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({
                data: [mockProfile],
                error: null
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Duplicate Prevention", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      // Mock valid session
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: mockUser.id }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });
    });

    it("should prevent duplicate invitations to same user", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: "test-user-123" }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation(),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No invitations could be created");
      expect(data.details).toContain("Invitation already sent to user");
    });

    it("should prevent invitations sent within 7 days", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: "test-user-123" }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest
                      .fn()
                      .mockResolvedValue({
                        data: createMockInvitation({
                          created_at: new Date().toISOString(),
                        }),
                        error: null,
                      }),
                  })),
                })),
              })),
            })),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No invitations could be created");
      expect(data.details).toContain(
        "Invitation already sent recently to user"
      );
    });

    it("should allow invitation if no recent invitation exists", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: "test-user-123" }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest
                      .fn()
                      .mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({
                    data: createMockInvitation(),
                    error: null,
                  }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          const mockProfile = createMockProfile({
                    id: "invitee-456",
                    email: "invitee@example.com",
                    email_session_invites: true,
                    inapp_session_invites: true,
                  });
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({
                data: [mockProfile],
                error: null
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Success Cases", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should create invitation to follower successfully", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: "test-user-123" }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest
                      .fn()
                      .mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({
                    data: createMockInvitation(),
                    error: null,
                  }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          const mockProfile = createMockProfile({
                    id: "invitee-456",
                    email: "invitee@example.com",
                    email_session_invites: true,
                    inapp_session_invites: true,
                  });
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({
                data: [mockProfile],
                error: null
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
            message: "Join me for a surf!",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(
        expect.objectContaining({
          sessionId: "session-123",
          invitationsSent: 1,
          invitations: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              sessionId: "session-123",
              status: "pending",
            }),
          ]),
        })
      );
    });

    it("should create multiple invitations successfully", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: "test-user-123" }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          let callCount = 0;
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest
                      .fn()
                      .mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockInvitation({
                    id: `invitation-${callCount++}`,
                  }),
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          const mockProfile = createMockProfile({
                    id: "invitee-456",
                    email: "invitee@example.com",
                    email_session_invites: true,
                    inapp_session_invites: true,
                  });
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({
                data: [mockProfile],
                error: null
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [
              { userId: "invitee-1" },
              { userId: "invitee-2" },
              { userId: "invitee-3" },
            ],
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitationsSent).toBe(3);
      expect(data.data.invitations).toHaveLength(3);
    });

    it("should include custom message in invitation", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: "test-user-123" }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest
                      .fn()
                      .mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({
                    data: createMockInvitation({
                      message: "Epic waves today!",
                    }),
                    error: null,
                  }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          const mockProfile = createMockProfile({
                    id: "invitee-456",
                    email: "invitee@example.com",
                    email_session_invites: true,
                    inapp_session_invites: true,
                  });
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({
                data: [mockProfile],
                error: null
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
            message: "Epic waves today!",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations[0].message).toBe("Epic waves today!");
    });
  });

  describe("Email Resolution", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should resolve email to existing user", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: "test-user-123" }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              ilike: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { id: "resolved-user-456" },
                  error: null,
                }),
              })),
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockProfile(),
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest
                      .fn()
                      .mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({
                    data: createMockInvitation({
                      invitee_id: "resolved-user-456",
                    }),
                    error: null,
                  }),
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ email: "existing@example.com" }],
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations[0].inviteeId).toBe("resolved-user-456");
    });

    it("should create invitation with email for non-existing user", async () => {
      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: "test-user-123" }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              ilike: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest
                      .fn()
                      .mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest
                  .fn()
                  .mockResolvedValue({
                    data: createMockInvitation({
                      invitee_id: null,
                      invitee_email: "newuser@example.com",
                    }),
                    error: null,
                  }),
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            sessionId: "session-123",
            invitees: [{ email: "newuser@example.com" }],
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.invitations[0].inviteeEmail).toBe("newuser@example.com");
      expect(data.data.invitations[0].inviteeId).toBeNull();
    });
  });

  describe("Idempotency", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should use idempotency key if provided", async () => {
      let insertedData: any = null;

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockSession({ user_id: "test-user-123" }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
                gt: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest
                      .fn()
                      .mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert: jest.fn((data: any) => {
              insertedData = data;
              return {
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation(),
                      error: null,
                    }),
                })),
              };
            }),
          };
        }
        if (table === "profiles") {
          const mockProfile = createMockProfile({
                    id: "invitee-456",
                    email: "invitee@example.com",
                    email_session_invites: true,
                    inapp_session_invites: true,
                  });
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              })),
              in: jest.fn(() => Promise.resolve({
                data: [mockProfile],
                error: null
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return mockSupabaseClient.from();
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/session-planner/invitations",
        {
          headers: {
            "Idempotency-Key": "unique-key-123",
          },
          body: {
            sessionId: "session-123",
            invitees: [{ userId: "invitee-456" }],
          },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(insertedData?.idempotency_key).toContain("unique-key-123");
    });
  });
});
