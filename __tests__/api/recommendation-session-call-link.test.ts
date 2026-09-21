/** @jest-environment node */

import { NextRequest } from "next/server";

const sessionId = "11111111-1111-4111-8111-111111111111";
const mockUser = { id: "user-1" };
let session: { id: string; call_id: string | null } | null = { id: sessionId, call_id: null };
let sessionOwner = "user-1";
let sessionError: { message: string } | null = null;
let updateError: { message: string } | null = null;
const updateSpy = jest.fn();

function buildSupabase() {
  return {
    from(table: string) {
      if (table !== "sessions") throw new Error(`Unexpected table ${table}`);
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn(() => Promise.resolve({
                data: sessionOwner === mockUser.id ? session : null,
                error: sessionError,
              })),
            })),
          })),
        })),
        update: jest.fn((payload: Record<string, unknown>) => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn(() => {
                updateSpy(payload);
                return Promise.resolve({ error: updateError });
              }),
            })),
          })),
        })),
      };
    },
  };
}

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth: (handler: (request: NextRequest, context: unknown) => unknown) =>
    (request: NextRequest) => handler(request, { user: mockUser, supabase: buildSupabase() }),
  withNoStore: (handler: unknown) => handler,
  withRateLimit: (handler: unknown) => handler,
}));

import { POST } from "@/app/api/recommendations/session-call-link/route";

function request(body: unknown, raw = false): NextRequest {
  return new NextRequest("http://localhost/api/recommendations/session-call-link", {
    method: "POST",
    body: raw ? String(body) : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function payload(callId = "call-1") {
  return { sessionId, callId };
}

describe("POST /api/recommendations/session-call-link", () => {
  beforeEach(() => {
    session = { id: sessionId, call_id: null };
    sessionOwner = "user-1";
    sessionError = null;
    updateError = null;
    updateSpy.mockClear();
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(request("not-json", true));
    expect(response.status).toBe(400);
  });

  it("rejects an invalid body", async () => {
    const response = await POST(request({ ...payload(), callId: "  " }));
    expect(response.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null, "user-1"],
    ["unowned", { id: sessionId, call_id: null }, "another-user"],
  ])("returns 404 for a %s session", async (_label, value, owner) => {
    session = value;
    sessionOwner = owner;
    const response = await POST(request(payload()));
    expect(response.status).toBe(404);
  });

  it("links a session on the first request", async () => {
    const response = await POST(request(payload(" call-1 ")));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { sessionId, callId: "call-1", linked: true },
    });
    expect(updateSpy).toHaveBeenCalledWith({ call_id: "call-1" });
  });

  it("is idempotent for the same call", async () => {
    session = { id: sessionId, call_id: "call-1" };
    const response = await POST(request(payload()));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ sessionId, callId: "call-1", linked: true });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects a conflicting call", async () => {
    session = { id: sessionId, call_id: "call-1" };
    const response = await POST(request(payload("call-2")));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: "Session already linked to another call" });
  });

  it("returns 500 for database errors", async () => {
    updateError = { message: "database unavailable" };
    const response = await POST(request(payload()));
    expect(response.status).toBe(500);
  });
});
