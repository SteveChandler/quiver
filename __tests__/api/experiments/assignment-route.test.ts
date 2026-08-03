jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockFrom = jest.fn();
const mockServiceClient = { from: mockFrom, insert: jest.fn(), update: jest.fn(), rpc: jest.fn() };

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => mockServiceClient,
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const { NextResponse } = require("next/server");
  return {
    createSuccessResponse: (data: unknown) => NextResponse.json({ success: true, data }),
    createValidationError: (error: string) => NextResponse.json({ success: false, error }, { status: 400 }),
    createNotFoundError: (resource: string) =>
      NextResponse.json({ success: false, error: `${resource} not found` }, { status: 404 }),
    withAuth: (handler: Function) => async (request: unknown, context: { user?: unknown }) => {
      if (!context?.user) return NextResponse.json({ success: false }, { status: 401 });
      return handler(request, context);
    },
    withNoStore: (handler: Function) => async (request: unknown, context: unknown) => {
      const response = await handler(request, context);
      response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
      return response;
    },
  };
});

import { GET } from "@/app/api/v1/experiments/assignment/route";

const USER_ONE = { id: "11111111-1111-4111-8111-111111111111" };
const USER_TWO = { id: "22222222-2222-4222-8222-222222222222" };

function request(key: string): never {
  return {
    nextUrl: new URL(`http://localhost:3000/api/v1/experiments/assignment?key=${key}`),
  } as never;
}

function configureRowLookup(rows: Record<string, unknown>) {
  mockFrom.mockImplementation(() => {
    const state: { userId?: string } = {};
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn((column: string, value: string) => {
        if (column === "user_id") state.userId = value;
        return builder;
      }),
      maybeSingle: jest.fn(async () => ({ data: rows[state.userId ?? ""] ?? null, error: null })),
    };
    return builder;
  });
}

describe("GET /api/v1/experiments/assignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureRowLookup({});
  });

  it("returns 401 without an authenticated user", async () => {
    const response = await GET(request("t3-quicklog-v1"), undefined as never);
    expect(response.status).toBe(401);
  });

  it("rejects unknown experiment keys", async () => {
    const response = await GET(request("unknown"), { user: USER_ONE } as never);
    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns a no-store 404 when the ledger row is absent", async () => {
    const response = await GET(request("t3-quicklog-v1"), { user: USER_ONE } as never);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("returns the persisted arm and never writes while resolving", async () => {
    configureRowLookup({
      [USER_ONE.id]: {
        experiment_key: "t3-quicklog-v1",
        arm: 1,
        assignment_version: "v1",
      },
    });

    const response = await GET(request("t3-quicklog-v1"), { user: USER_ONE } as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { experiment_key: "t3-quicklog-v1", arm: 1, assignment_version: "v1" },
    });
    expect(mockServiceClient.insert).not.toHaveBeenCalled();
    expect(mockServiceClient.update).not.toHaveBeenCalled();
    expect(mockServiceClient.rpc).not.toHaveBeenCalled();
  });

  it("queries each authenticated user independently without a cached row", async () => {
    configureRowLookup({
      [USER_ONE.id]: { experiment_key: "t3-quicklog-v1", arm: 0, assignment_version: "v1" },
      [USER_TWO.id]: { experiment_key: "t3-quicklog-v1", arm: 1, assignment_version: "v1" },
    });

    const first = await GET(request("t3-quicklog-v1"), { user: USER_ONE } as never);
    const second = await GET(request("t3-quicklog-v1"), { user: USER_TWO } as never);

    await expect(first.json()).resolves.toMatchObject({ data: { arm: 0 } });
    await expect(second.json()).resolves.toMatchObject({ data: { arm: 1 } });
    const userIdCalls = mockFrom.mock.results.flatMap(({ value }) =>
      value.eq.mock.calls.filter(([column]: [string]) => column === "user_id").map(([, id]: [string, string]) => id)
    );
    expect(userIdCalls).toEqual([USER_ONE.id, USER_TWO.id]);
  });
});
