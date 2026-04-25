/**
 * @jest-environment node
 */

import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

const mockServiceRoleClient = {
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceRoleClient: jest.fn(() => mockServiceRoleClient),
}));

describe("GET /api/roadmap/submissions/duplicate-search", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const route = await import(
      "@/app/api/roadmap/submissions/duplicate-search/route"
    );
    GET = route.GET;
  });

  const makeReq = (query: string) =>
    new Request(`http://localhost/api/roadmap/submissions/duplicate-search?${query}`);

  // Builds a chainable mock that resolves at .limit()
  const buildChain = (result: { data: unknown; error: unknown }) => {
    const limitMock = jest.fn().mockResolvedValue(result);
    const orderMock = jest.fn().mockReturnValue({ limit: limitMock });
    const ilikeMock = jest.fn().mockReturnValue({ order: orderMock });
    const inMock = jest.fn().mockReturnValue({ ilike: ilikeMock });
    const selectMock = jest.fn().mockReturnValue({ in: inMock });
    return { selectMock, inMock, ilikeMock, orderMock, limitMock };
  };

  it("1. query < 2 chars → empty matches, no DB call", async () => {
    const res = await GET(makeReq("q=a"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ matches: [] });
    expect(mockServiceRoleClient.from).not.toHaveBeenCalled();
  });

  it("2. empty query → empty matches", async () => {
    const res = await GET(makeReq("q="));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ matches: [] });
    expect(mockServiceRoleClient.from).not.toHaveBeenCalled();
  });

  it("3. whitespace-only query → empty matches", async () => {
    const res = await GET(makeReq("q=%20%20"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ matches: [] });
    expect(mockServiceRoleClient.from).not.toHaveBeenCalled();
  });

  it("4. valid query → top-3 matching items returned", async () => {
    const mockRows = [
      { id: "a", title: "Watch app", status: "under_consideration", vote_count: 5 },
      { id: "b", title: "Watchlist", status: "in_progress", vote_count: 2 },
    ];
    const { selectMock, ilikeMock } = buildChain({ data: mockRows, error: null });
    mockServiceRoleClient.from.mockReturnValue({ select: selectMock });

    const res = await GET(makeReq("q=watch"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.matches).toHaveLength(2);
    expect(body.matches[0].id).toBe("a");
    expect(ilikeMock).toHaveBeenCalledWith("title", "%watch%");
  });

  it("5. .limit(3) was called", async () => {
    const { selectMock, limitMock } = buildChain({ data: [], error: null });
    mockServiceRoleClient.from.mockReturnValue({ select: selectMock });

    await GET(makeReq("q=surf"));

    expect(limitMock).toHaveBeenCalledWith(3);
  });

  it("6. filters on active statuses only", async () => {
    const { selectMock, inMock } = buildChain({ data: [], error: null });
    mockServiceRoleClient.from.mockReturnValue({ select: selectMock });

    await GET(makeReq("q=tide"));

    expect(inMock).toHaveBeenCalledWith("status", ["under_consideration", "in_progress"]);
  });

  it("7. LIKE-wildcard escape: user-typed % becomes \\%", async () => {
    const { selectMock, ilikeMock } = buildChain({ data: [], error: null });
    mockServiceRoleClient.from.mockReturnValue({ select: selectMock });

    // URL-encoded '50%' → q param value is '50%'
    await GET(makeReq("q=50%25"));

    expect(ilikeMock).toHaveBeenCalledWith("title", "%50\\%%");
  });

  it("8. LIKE-wildcard escape: user-typed _ becomes \\_", async () => {
    const { selectMock, ilikeMock } = buildChain({ data: [], error: null });
    mockServiceRoleClient.from.mockReturnValue({ select: selectMock });

    await GET(makeReq("q=my_field"));

    expect(ilikeMock).toHaveBeenCalledWith("title", "%my\\_field%");
  });

  it("9. DB error → 500 with generic message", async () => {
    const { selectMock } = buildChain({ data: null, error: { message: "db fail" } });
    mockServiceRoleClient.from.mockReturnValue({ select: selectMock });

    const res = await GET(makeReq("q=anything"));
    const body = await res.json();

    expectConsoleErrors([/\[roadmap\] duplicate-search query error/]);
    expect(res.status).toBe(500);
    expect(body.error).toBe("Could not search roadmap items");
  });

  it("10. sort order: .order() called before .limit()", async () => {
    const calls: string[] = [];
    const limitMock = jest.fn().mockImplementation(() => {
      calls.push("limit");
      return Promise.resolve({ data: [], error: null });
    });
    const orderMock = jest.fn().mockImplementation(() => {
      calls.push("order");
      return { limit: limitMock };
    });
    const ilikeMock = jest.fn().mockReturnValue({ order: orderMock });
    const inMock = jest.fn().mockReturnValue({ ilike: ilikeMock });
    const selectMock = jest.fn().mockReturnValue({ in: inMock });
    mockServiceRoleClient.from.mockReturnValue({ select: selectMock });

    await GET(makeReq("q=swell"));

    expect(orderMock).toHaveBeenCalledWith("vote_count", { ascending: false });
    expect(calls).toEqual(["order", "limit"]);
  });
});
