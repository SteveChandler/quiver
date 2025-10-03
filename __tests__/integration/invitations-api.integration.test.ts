/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

jest.mock("@/lib/supabase/server", () => {
  const original = jest.requireActual("@/lib/supabase/server");
  const { mockSupabaseClient } = require("@/__tests__/setup/mock-supabase");

  return {
    ...original,
    createSupabaseServerClient: jest.fn(async () => mockSupabaseClient),
    createSupabaseServiceRoleClient: jest.fn(async () => mockSupabaseClient),
  };
});

jest.mock("@/lib/mailer/sessionInviteEmail", () => ({
  sendSessionInviteEmail: jest.fn(async () => true),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMockModule = require("@/__tests__/setup/mock-supabase");
const mockSupabaseClient =
  supabaseMockModule.default || supabaseMockModule.mockSupabaseClient;

if (!mockSupabaseClient || typeof mockSupabaseClient.from !== "function") {
  throw new Error(
    `Supabase mock could not be resolved. Available keys: ${Object.keys(
      supabaseMockModule || {}
    ).join(",")}`
  );
}

const { sendSessionInviteEmail } = require("@/lib/mailer/sessionInviteEmail");

function seedSupabaseMocks() {
  const sessionRecord = {
    id: "session-1",
    user_id: "user-1",
    status: "planned",
    beach_name: "Pipeline",
    arrival_time: "2025-09-24T14:00:00.000Z",
  };

  const insertedInvites: any[] = [];
  if (!mockSupabaseClient.__tableMocks) {
    mockSupabaseClient.__tableMocks = {};
  } else {
    Object.keys(mockSupabaseClient.__tableMocks).forEach((key) => {
      delete mockSupabaseClient.__tableMocks[key];
    });
  }

  mockSupabaseClient.setTableMock("sessions", () => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(async () => ({ data: sessionRecord, error: null })) })) })),
    })),
  }));

  mockSupabaseClient.setTableMock("session_invitations", () => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: null, error: null })) })),
      gt: jest.fn(() => ({ order: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: null, error: null })) })) })),
    })),
    insert: jest.fn((payload: any) => ({
      select: jest.fn(() => ({
        single: jest.fn(async () => {
          const record = { id: `invite-${insertedInvites.length + 1}`, ...payload };
          insertedInvites.push(record);
          return { data: record, error: null };
        }),
      })),
    })),
  }));

  mockSupabaseClient.setTableMock("profiles", () => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({ single: jest.fn(async () => ({ data: { id: "invitee-1", email: "friend@example.com", email_session_invites: true, inapp_session_invites: true }, error: null })) })),
    })),
  }));

  return { sessionRecord, insertedInvites };
}

describe("POST /api/session-planner/invitations (integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedSupabaseMocks();
  });

  it("creates invitations and returns aggregate metrics", async () => {
    const { POST } = await import("@/app/api/session-planner/invitations/route");

    const requestBody = {
      sessionId: "session-1",
      invitees: [
        { email: "friend@example.com", name: "Friend" },
        { email: "second@example.com", name: "Second" },
      ],
      message: "Come surf!",
    };

    const req = new NextRequest("http://localhost/api/session-planner/invitations", {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "abc-123",
      },
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.sessionId).toBe("session-1");
    expect(json.data.invitationsSent).toBe(2);
    expect(Array.isArray(json.data.invitations)).toBe(true);
    expect(json.data.errors).toEqual([]);
    expect(sendSessionInviteEmail).toHaveBeenCalled();
  });
});
