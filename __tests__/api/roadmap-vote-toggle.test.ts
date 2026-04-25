/**
 * @jest-environment node
 */

import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

// Mock Supabase clients before any imports.
// withAuth routes through createSupabaseServerClient (cookie/web) or
// createBearerTokenClient (native). Tests drive cookie path by omitting
// the Authorization header; both mocks still need to exist because
// api-wrappers imports them at module load.
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

const mockServiceRoleClient = {
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => mockSupabaseClient),
  createSupabaseServiceRoleClient: jest.fn(() => mockServiceRoleClient),
}));

jest.mock("@/lib/supabase/bearer-client", () => ({
  createBearerTokenClient: jest.fn(() => mockSupabaseClient),
}));

describe("POST /api/roadmap/items/[id]/vote", () => {
  let POST: any;
  let NextRequest: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const route = await import(
      "@/app/api/roadmap/items/[id]/vote/route"
    );
    POST = route.POST;

    const nextServer = await import("next/server");
    NextRequest = nextServer.NextRequest;

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
  });

  const makeReq = () =>
    new NextRequest(
      new URL("http://localhost/api/roadmap/items/abc/vote"),
      { method: "POST" },
    );

  it("1. anon → 401", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await POST(makeReq(), { params: { id: "abc" } });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("2. first vote (no existing) → inserts and returns { voted: true }", async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "roadmap_votes") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: mockInsert,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(makeReq(), { params: { id: "abc" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.voted).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({ item_id: "abc", user_id: "u1" });
  });

  it("3. toggle off (existing vote) → deletes, returns { voted: false }, insert NOT called", async () => {
    const mockDelete = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    const mockInsert = jest.fn();

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "roadmap_votes") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { item_id: "abc" },
                  error: null,
                }),
              }),
            }),
          }),
          delete: mockDelete,
          insert: mockInsert,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(makeReq(), { params: { id: "abc" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.voted).toBe(false);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("4. insert error (non-23505) → 500 with generic message", async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "roadmap_votes") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: jest.fn().mockResolvedValue({
            error: { code: "23503", message: "fk violation" },
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(makeReq(), { params: { id: "abc" } });
    const body = await res.json();

    expectConsoleErrors([/\[roadmap\] vote insert error/]);
    expect(res.status).toBe(500);
    expect(body.error).toBe("Could not record vote");
  });

  it("5. delete error → 500 with generic message", async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "roadmap_votes") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { item_id: "abc" },
                  error: null,
                }),
              }),
            }),
          }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: { message: "rls denied" } }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(makeReq(), { params: { id: "abc" } });
    const body = await res.json();

    expectConsoleErrors([/\[roadmap\] vote delete error/]);
    expect(res.status).toBe(500);
    expect(body.error).toBe("Could not record vote");
  });

  it("6. getUser throws → treated as anon → 401", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValue(new Error("network error"));

    const res = await POST(makeReq(), { params: { id: "abc" } });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("7. 23505 unique violation on insert → idempotent { voted: true }", async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "roadmap_votes") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: jest.fn().mockResolvedValue({
            error: {
              code: "23505",
              message: "duplicate key violates roadmap_votes_pkey",
            },
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(makeReq(), { params: { id: "abc" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.voted).toBe(true);
  });
});
