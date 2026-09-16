/** @jest-environment node */

import { NextRequest } from "next/server";

const results: Record<string, { data: unknown; error: null }> = {
  user_events: { data: [], error: null },
  forecast_feedback_contexts: { data: [], error: null },
  sessions: { data: [], error: null },
  boards: { data: null, error: null },
};

function queryFor(table: string): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "order", "in"]) {
    query[method] = jest.fn(() => query);
  }
  query.then = (resolve: (result: unknown) => unknown) =>
    Promise.resolve(resolve(results[table]));
  query.maybeSingle = jest.fn(() => Promise.resolve(results[table]));
  return query;
}

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => ({ from: (table: string) => queryFor(table) }),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  isValidUuid: () => true,
  withAuth: (handler: (request: NextRequest, context: unknown) => unknown) =>
    (request: NextRequest) => handler(request, { user: { id: "user-1" } }),
  withNoStore: (handler: unknown) => handler,
  withRateLimit: (handler: unknown) => handler,
}));

import { GET } from "@/app/api/recommendations/pending-call-check/route";

const beachId = "11111111-1111-4111-8111-111111111111";
const now = Date.now();

function exposure(callId: string, forecastAt: string, createdAt = new Date(now - 60 * 60 * 1000).toISOString()) {
  return {
    beach_id: beachId,
    created_at: createdAt,
    metadata: {
      call_id: callId,
      forecast_at: forecastAt,
      surface: "home",
      label: "EPIC",
      board_id: "22222222-2222-4222-8222-222222222222",
      is_any_board: false,
    },
  };
}

function request(): NextRequest {
  return new NextRequest(`http://localhost/api/recommendations/pending-call-check?beachId=${beachId}`);
}

beforeEach(() => {
  results.user_events = { data: [], error: null };
  results.forecast_feedback_contexts = { data: [], error: null };
  results.sessions = { data: [], error: null };
  results.boards = { data: { name: "Mid", board_type: "midlength" }, error: null };
});

describe("GET /api/recommendations/pending-call-check", () => {
  it("returns the most recent ended un answered call and owned board details", async () => {
    results.user_events.data = [
      exposure("newer", new Date(now - 5 * 60 * 60 * 1000).toISOString(), new Date(now - 10 * 60 * 1000).toISOString()),
      exposure("older", new Date(now - 8 * 60 * 60 * 1000).toISOString(), new Date(now - 50 * 60 * 1000).toISOString()),
    ];

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        call: expect.objectContaining({ callId: "newer", boardName: "Mid", boardType: "midlength" }),
      },
    });
  });

  it.each([
    ["answered", "forecast_feedback_contexts"],
    ["logged", "sessions"],
  ])("excludes a call that is already %s", async (_label, table) => {
    results.user_events.data = [exposure("call-1", new Date(now - 5 * 60 * 60 * 1000).toISOString())];
    results[table].data = [{ call_id: "call-1" }];

    const response = await GET(request());
    expect((await response.json()).data.call).toBeNull();
  });

  it("excludes a call whose forecast slot has not ended", async () => {
    results.user_events.data = [exposure("call-1", new Date(now - 2 * 60 * 60 * 1000).toISOString())];

    const response = await GET(request());
    expect((await response.json()).data.call).toBeNull();
  });
});
