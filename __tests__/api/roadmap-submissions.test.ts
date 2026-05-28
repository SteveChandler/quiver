/**
 * @jest-environment node
 */

import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

// Mock Supabase clients before any imports.
// withAuth routes through createSupabaseServerClient (cookie/web) or
// createBearerTokenClient (native). Tests drive cookie path by omitting
// the Authorization header; both mocks still need to exist because
// api-wrappers imports them at module load.

// withRateLimit is a pass-through in test env so rate limiting doesn't
// interfere with unit test assertions.
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withRateLimit: (handler: Function) => handler,
  };
});
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

describe("POST /api/roadmap/submissions", () => {
  let POST: any;
  let NextRequest: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const route = await import("@/app/api/roadmap/submissions/route");
    POST = route.POST;

    const nextServer = await import("next/server");
    NextRequest = nextServer.NextRequest;

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
  });

  const makeReq = (body: unknown) =>
    new NextRequest(
      new URL("http://localhost/api/roadmap/submissions"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      },
    );

  const validBody = {
    title: "Add tide charts",
    description: "Would love to see tide charts on the beach page",
    category: "forecasts",
  };

  it("1. anon → 401", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("2. invalid JSON → 400", async () => {
    const req = new NextRequest(
      new URL("http://localhost/api/roadmap/submissions"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      },
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid JSON");
  });

  it("3. missing title → 400", async () => {
    const res = await POST(makeReq({ description: "d", category: "other" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/title/i);
  });

  it("4. empty title after trim → 400", async () => {
    const res = await POST(
      makeReq({ title: "   ", description: "d", category: "other" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/title/i);
  });

  it("5. title too long (61 chars) → 400", async () => {
    const res = await POST(
      makeReq({ title: "a".repeat(61), description: "d", category: "other" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/title/i);
  });

  it("6. missing description → 400", async () => {
    const res = await POST(
      makeReq({ title: "Valid title", category: "other" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/description/i);
  });

  it("7. description too long (501 chars) → 400", async () => {
    const res = await POST(
      makeReq({ title: "Valid title", description: "a".repeat(501), category: "other" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/description/i);
  });

  it("8. invalid category ('pizza') → 400", async () => {
    const res = await POST(
      makeReq({ title: "Valid title", description: "Valid description", category: "pizza" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/category/i);
  });

  it("9. valid submission → 200 with { id, decision: 'pending' }, insert called with correct payload", async () => {
    const mockSingle = jest.fn().mockResolvedValue({ data: { id: "sub-1" }, error: null });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    const mockEventInsert = jest.fn().mockResolvedValue({ error: null });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "roadmap_item_submissions") {
        return { insert: mockInsert };
      }
      if (table === "user_events") {
        return { insert: mockEventInsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("sub-1");
    expect(body.decision).toBe("pending");
    expect(mockInsert).toHaveBeenCalledWith({
      title: "Add tide charts",
      description: "Would love to see tide charts on the beach page",
      category: "forecasts",
      submitter_user_id: "u1",
    });
    expect(mockEventInsert).toHaveBeenCalledWith({
      user_id: "u1",
      event_type: "feedback_roadmap_request_created",
      metadata: {
        source: "web_roadmap",
        roadmap_submission_id: "sub-1",
        category: "forecasts",
        is_custom_spot_request: false,
      },
    });
  });

  it("10. DB insert error → 500 with generic message", async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "rls denied" },
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "roadmap_item_submissions") {
        return { insert: mockInsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expectConsoleErrors([/\[roadmap\] submission insert error/]);
    expect(res.status).toBe(500);
    expect(body.error).toBe("Could not save submission");
  });

  it("11. title with leading/trailing whitespace is trimmed before insert", async () => {
    const mockSingle = jest.fn().mockResolvedValue({ data: { id: "sub-2" }, error: null });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    const mockEventInsert = jest.fn().mockResolvedValue({ error: null });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "roadmap_item_submissions") {
        return { insert: mockInsert };
      }
      if (table === "user_events") {
        return { insert: mockEventInsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(
      makeReq({ title: "  hello  ", description: "d", category: "other" }),
    );

    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ title: "hello" }),
    );
  });
});
