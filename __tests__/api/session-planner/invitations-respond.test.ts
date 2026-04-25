/**
 * @jest-environment node
 */

import { PATCH } from "@/app/api/session-planner/invitations/route";
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
    invitee_id: "test-user-123",
    invitee_email: "test@example.com",
    status: "pending",
    message: "Join me for a surf!",
    created_at: "2024-01-15T00:00:00Z",
    seen_at: null,
    responded_at: null,
    ...overrides,
  };
}

function createMockSession(overrides = {}) {
  return {
    id: "session-123",
    user_id: "inviter-456",
    beach_name: "Ocean Beach",
    arrival_time: "2024-01-20T10:00:00Z",
    status: "planned",
    created_at: "2024-01-15T00:00:00Z",
    ...overrides,
  };
}

function createMockProfile(overrides = {}) {
  return {
    id: "profile-123",
    email: "inviter@example.com",
    full_name: "Inviter User",
    email_session_invites: true,
    inapp_session_invites: true,
    ...overrides,
  };
}

describe("/api/session-planner/invitations - PATCH", () => {
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
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(response, 401, "Authentication required");
    });

    it("should work with authenticated user", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({ invitee_id: mockUser.id }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "accepted",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession(),
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
                  data: createMockProfile(),
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
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Input Validation - Response", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should require invitationId for response", async () => {
      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        400,
        "Invitation ID and response are required"
      );
    });

    it("should require response value", async () => {
      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        400,
        "Invitation ID and response are required"
      );
    });

    it("should only accept 'accepted' or 'declined' responses", async () => {
      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "invalid",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        400,
        "Response must be 'accepted' or 'declined'"
      );
    });

    it("should accept 'accepted' response", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({ invitee_id: mockUser.id }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "accepted",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession(),
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
                  data: createMockProfile(),
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
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(200);
    });

    it("should accept 'declined' response", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({ invitee_id: mockUser.id }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "declined",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession(),
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
                  data: createMockProfile(),
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
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "declined",
          },
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Input Validation - Mark Seen", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should require invitationIds array when markSeen is true", async () => {
      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            markSeen: true,
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        400,
        "Invitation IDs are required to mark notifications as seen"
      );
    });

    it("should require non-empty invitationIds array", async () => {
      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            markSeen: true,
            invitationIds: [],
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        400,
        "Invitation IDs are required to mark notifications as seen"
      );
    });

    it("should mark invitations as seen successfully", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            update: jest.fn(() => ({
              in: jest.fn(() => ({
                select: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: "invitation-1",
                      seen_at: "2024-01-15T10:00:00Z",
                    },
                    {
                      id: "invitation-2",
                      seen_at: "2024-01-15T10:00:00Z",
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            markSeen: true,
            invitationIds: ["invitation-1", "invitation-2"],
          },
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.updated).toHaveLength(2);
    });
  });

  describe("Authorization", () => {
    beforeEach(() => {
      const mockUser = createMockUser({ id: "test-user-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should reject response to non-existent invitation", async () => {
      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Invitation not found" },
                  }),
                })),
              })),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "nonexistent-invitation",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        404,
        "Invitation not found or access denied"
      );
    });

    it("should reject response to invitation for different user by ID", async () => {
      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "other-user-invitation",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        404,
        "Invitation not found or access denied"
      );
    });

    it("should allow response to invitation by invitee ID", async () => {
      const mockUser = createMockUser({ id: "test-user-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({ invitee_id: mockUser.id }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "accepted",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession(),
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
                  data: createMockProfile(),
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
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(200);
    });

    it("should allow response to invitation by invitee email", async () => {
      const mockUser = createMockUser({
        id: "test-user-123",
        email: "test@example.com",
      });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: null,
                        invitee_email: mockUser.email,
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_email: mockUser.email,
                        status: "accepted",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession(),
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
                  data: createMockProfile(),
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
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Response State Validation", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should reject response to already-accepted invitation", async () => {
      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: "test-user-123",
                        status: "accepted",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "declined",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        400,
        "Invitation has already been responded to"
      );
    });

    it("should reject response to already-declined invitation", async () => {
      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: "test-user-123",
                        status: "declined",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        400,
        "Invitation has already been responded to"
      );
    });

    it("should allow response to pending invitation", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "pending",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "accepted",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession(),
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
                  data: createMockProfile(),
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
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Success Cases", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should accept invitation successfully", async () => {
      const mockUser = createMockUser({ id: "test-user-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "pending",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "accepted",
                        responded_at: "2024-01-15T10:00:00Z",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession(),
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
                  data: createMockProfile(),
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
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.invitation.status).toBe("accepted");
      expect(data.data.message).toBe("Invitation accepted");
    });

    it("should decline invitation successfully", async () => {
      const mockUser = createMockUser({ id: "test-user-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "pending",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "declined",
                        responded_at: "2024-01-15T10:00:00Z",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession(),
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
                  data: createMockProfile(),
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
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "declined",
          },
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.invitation.status).toBe("declined");
      expect(data.data.message).toBe("Invitation declined");
    });

    it("should set responded_at timestamp on response", async () => {
      const mockUser = createMockUser({ id: "test-user-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      let updateData: any = null;

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: mockUser.id,
                        status: "pending",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn((data: any) => {
              updateData = data;
              return {
                eq: jest.fn(() => ({
                  select: jest.fn(() => ({
                    single: jest
                      .fn()
                      .mockResolvedValue({
                        data: createMockInvitation({
                          invitee_id: mockUser.id,
                          status: "accepted",
                          responded_at: data.responded_at,
                        }),
                        error: null,
                      }),
                  })),
                })),
              };
            }),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession(),
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
                  data: createMockProfile(),
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
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      await PATCH(request);

      expect(updateData).toHaveProperty("responded_at");
      expect(updateData.responded_at).toBeTruthy();
    });
  });

  describe("Notification to Session Creator", () => {
    beforeEach(() => {
      const mockUser = createMockUser({ id: "invitee-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should send notification to session creator on accept", async () => {
      let notificationInserted = false;

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: "invitee-123",
                        inviter_id: "inviter-456",
                        status: "pending",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: "invitee-123",
                        status: "accepted",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession({ user_id: "inviter-456" }),
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
                  data: createMockProfile({ id: "inviter-456" }),
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn(() => {
              notificationInserted = true;
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      await PATCH(request);
      expect(notificationInserted).toBe(true);
    });

    it("should send notification to session creator on decline", async () => {
      let notificationInserted = false;

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: "invitee-123",
                        inviter_id: "inviter-456",
                        status: "pending",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: "invitee-123",
                        status: "declined",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession({ user_id: "inviter-456" }),
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
                  data: createMockProfile({ id: "inviter-456" }),
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn(() => {
              notificationInserted = true;
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "declined",
          },
        }
      );

      await PATCH(request);
      expect(notificationInserted).toBe(true);
    });

    it("should not send notification if invitee is session creator", async () => {
      const mockUser = createMockUser({ id: "creator-123" });
      mockAuthenticatedUser(mockSupabaseClient, mockUser);

      let notificationInserted = false;

      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: "creator-123",
                        status: "pending",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: "creator-123",
                        status: "accepted",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: createMockSession({ user_id: "creator-123" }),
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            insert: jest.fn(() => {
              notificationInserted = true;
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }
        if (table === "user_events") {
          return {
            insert: jest.fn().mockReturnValue({
              then: jest.fn((cb: any) => {
                cb?.();
                return { catch: jest.fn() };
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      await PATCH(request);
      expect(notificationInserted).toBe(false);
    });
  });

  describe("Database Error Handling", () => {
    beforeEach(() => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabaseClient, mockUser);
    });

    it("should handle database error when fetching invitation", async () => {
      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Database connection failed" },
                  }),
                })),
              })),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        404,
        "Invitation not found or access denied"
      );
    });

    it("should handle database error when updating invitation", async () => {
      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  single: jest
                    .fn()
                    .mockResolvedValue({
                      data: createMockInvitation({
                        invitee_id: "test-user-123",
                      }),
                      error: null,
                    }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Update failed" },
                  }),
                })),
              })),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            invitationId: "invitation-123",
            response: "accepted",
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(response, 500, "Failed to update invitation");
    });

    it("should handle error when marking invitations as seen", async () => {
      mockSupabaseClient.from.mockImplementation(((table: string) => {
        if (table === "session_invitations") {
          return {
            update: jest.fn(() => ({
              in: jest.fn(() => ({
                select: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Update failed" },
                }),
              })),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            then: jest.fn((cb: any) => { cb?.(); return { catch: jest.fn() }; }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }) as any);

      const request = createMockRequest(
        "PATCH",
        "http://localhost:3000/api/session-planner/invitations",
        {
          body: {
            markSeen: true,
            invitationIds: ["invitation-1", "invitation-2"],
          },
        }
      );

      const response = await PATCH(request);
      await expectErrorResponse(
        response,
        500,
        "Failed to mark invitations as seen"
      );
    });
  });
});
