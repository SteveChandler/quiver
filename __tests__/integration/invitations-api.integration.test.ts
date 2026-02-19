/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const supabaseTestContext = createSupabaseTestContext();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => supabaseTestContext.client),
  createSupabaseServiceRoleClient: jest.fn(
    async () => supabaseTestContext.client
  ),
}));

jest.mock("@/lib/mailer/sessionInviteEmail", () => ({
  sendSessionInviteEmail: jest.fn(async () => true),
}));

jest.mock("@/lib/notifications", () => ({
  notifySessionInvite: jest.fn(async () => ({ success: true })),
}));

const { sendSessionInviteEmail } = require("@/lib/mailer/sessionInviteEmail");

function seedSupabaseMocks() {
  const sessionRecord = {
    id: "session-1",
    user_id: "user-1",
    status: "planned",
    beach_name: "Pipeline",
    arrival_time: "2025-09-24T14:00:00.000Z",
  };

  supabaseTestContext.reset({
    session: sessionRecord,
    invitees: [
      {
        id: "invitee-1",
        email: "friend@example.com",
        full_name: "Friend One",
        avatar_url: null,
        email_session_invites: true,
        inapp_session_invites: true,
      },
      {
        id: "invitee-2",
        email: "second@example.com",
        full_name: "Friend Two",
        avatar_url: null,
        email_session_invites: true,
        inapp_session_invites: true,
      },
    ],
  });

  return {
    sessionRecord,
    insertedInvites: supabaseTestContext.invitations,
  };
}

function createSupabaseTestContext() {
  const invitations: any[] = [];
  let sessionRecord: any = null;
  let inviteeProfiles: any[] = [];

  const client = {
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null })
      ),
    },
    from(table: string) {
      switch (table) {
        case "sessions":
          return {
            select: jest.fn(() => {
              const filters: Record<string, any> = {};
              const chain: any = {
                eq: jest.fn((field: string, value: any) => {
                  filters[field] = value;
                  return chain;
                }),
                in: jest.fn((_field: string, values: string[]) =>
                  Promise.resolve({
                    data:
                      sessionRecord && values.includes(sessionRecord.id)
                        ? [sessionRecord]
                        : [],
                    error: null,
                  })
                ),
                single: jest.fn(async () => ({
                  data:
                    sessionRecord &&
                    filters.id === sessionRecord.id &&
                    filters.user_id === sessionRecord.user_id
                      ? sessionRecord
                      : null,
                  error: null,
                })),
                maybeSingle: jest.fn(async () => ({
                  data:
                    sessionRecord &&
                    filters.id === sessionRecord.id &&
                    (!filters.user_id || filters.user_id === sessionRecord.user_id)
                      ? sessionRecord
                      : null,
                  error: null,
                })),
                order: jest.fn(() => chain),
              };
              return chain;
            }),
          };
        case "session_invitations":
          return {
            select: jest.fn(() => {
              const filters: Record<string, any> = {};
              const chain: any = {
                eq: jest.fn((field: string, value: any) => {
                  filters[field] = value;
                  return chain;
                }),
                in: jest.fn((_field: string, values: string[]) => ({
                  order: jest.fn(() => chain),
                  maybeSingle: jest.fn(async () => ({
                    data:
                      invitations.find((inv) => values.includes(inv.id)) || null,
                    error: null,
                  })),
                  select: jest.fn(() => chain),
                  single: jest.fn(async () => ({
                    data: invitations.filter((inv) => values.includes(inv.id)),
                    error: null,
                  })),
                })),
                order: jest.fn(() => chain),
                maybeSingle: jest.fn(async () => ({
                  data:
                    invitations.find((inv) =>
                      Object.entries(filters).every(
                        ([key, value]) =>
                          inv[key as keyof typeof inv] === value
                      )
                    ) || null,
                  error: null,
                })),
                single: jest.fn(async () => ({
                  data:
                    invitations.find((inv) =>
                      Object.entries(filters).every(
                        ([key, value]) =>
                          inv[key as keyof typeof inv] === value
                      )
                    ) || null,
                  error: null,
                })),
              };
              return chain;
            }),
            insert: jest.fn((records: any[]) => ({
              select: jest.fn(() => ({
                single: jest.fn(async () => {
                  const payload = records[0] || {};
                  const record = {
                    id: `invite-${invitations.length + 1}`,
                    session_id: payload.session_id,
                    inviter_id: payload.inviter_id,
                    invitee_id: payload.invitee_id ?? null,
                    invitee_email: payload.invitee_email ?? null,
                    status: "pending",
                    message: payload.message ?? null,
                    created_at: new Date().toISOString(),
                    seen_at: null,
                  };
                  invitations.push(record);
                  return { data: record, error: null };
                }),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(async () => ({
                    data: invitations[0] || null,
                    error: null,
                  })),
                })),
              })),
            })),
          };
        case "profiles":
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(async () => ({
                  data: inviteeProfiles[0] || null,
                  error: null,
                })),
                maybeSingle: jest.fn(async () => ({
                  data: inviteeProfiles[0] || null,
                  error: null,
                })),
              })),
              in: jest.fn((_field: string, values: string[]) => ({
                select: jest.fn(() => ({
                  order: jest.fn(() => ({
                    maybeSingle: jest.fn(async () => ({
                      data: null,
                      error: null,
                    })),
                    select: jest.fn(() => ({
                      order: jest.fn(() => ({
                        maybeSingle: jest.fn(async () => ({
                          data: null,
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
                maybeSingle: jest.fn(async () => ({
                  data: inviteeProfiles.find((profile) =>
                    values.includes(profile.id)
                  ) || null,
                  error: null,
                })),
              })),
            })),
          };
        case "notifications":
          return {
            insert: jest.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
          };
        case "session_invite_audit":
          return {
            insert: jest.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
          };
        default:
          return {
            select: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({ data: null, error: null })),
              single: jest.fn(async () => ({ data: null, error: null })),
              eq: jest.fn(() => ({ single: jest.fn(async () => ({ data: null, error: null })) })),
            })),
            insert: jest.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
          };
      }
    },
  };

  return {
    client,
    invitations,
    reset({
      session,
      invitees,
    }: {
      session: any;
      invitees: any[];
    }) {
      sessionRecord = session;
      inviteeProfiles = invitees;
      invitations.length = 0;
    },
  };
}

describe("POST /api/session-planner/invitations (integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedSupabaseMocks();
  });

  test.todo("creates invitations and returns aggregate metrics - requires realistic Supabase test harness for end-to-end validation");
});
