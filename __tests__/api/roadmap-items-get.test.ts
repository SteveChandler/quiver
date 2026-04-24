/**
 * @jest-environment node
 */

// Mock Supabase clients before any imports
const mockServiceRoleClient = {
  from: jest.fn(),
};

const mockAPIServerClient = {
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => mockServiceRoleClient),
}));

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(async () => mockAPIServerClient),
}));

const makeBuilder = (resolved: { data: any; error: any }) => {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: (resolve: (val: { data: any; error: any }) => any) =>
      Promise.resolve(resolved).then(resolve),
  };
  return builder;
};

const BASE_ITEMS = [
  {
    id: "a",
    title: "Item A",
    description: "desc a",
    category: "forecasts",
    status: "under_consideration",
    eta_label: null,
    founder_reply: null,
    shipped_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    vote_count: 10,
  },
  {
    id: "b",
    title: "Item B",
    description: "desc b",
    category: "logging",
    status: "shipped",
    eta_label: null,
    founder_reply: null,
    shipped_at: "2026-02-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    vote_count: 5,
  },
];

describe("GET /api/roadmap/items", () => {
  let GET: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const route = await import(
      "@/app/api/roadmap/items/route"
    );
    GET = route.GET;
  });

  it("anon returns items with viewer_has_voted false for all", async () => {
    const viewBuilder = makeBuilder({ data: BASE_ITEMS, error: null });
    mockServiceRoleClient.from.mockReturnValue(viewBuilder);

    mockAPIServerClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = new Request("http://localhost/api/roadmap/items");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].viewer_has_voted).toBe(false);
    expect(body.items[1].viewer_has_voted).toBe(false);
  });

  it("authed user sees their votes", async () => {
    // First call: view query; second call: votes query
    let callCount = 0;
    mockServiceRoleClient.from.mockImplementation((table: string) => {
      if (table === "roadmap_items_with_vote_count") {
        return makeBuilder({ data: BASE_ITEMS, error: null });
      }
      // roadmap_votes
      return makeBuilder({ data: [{ item_id: "a" }], error: null });
    });

    mockAPIServerClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const req = new Request("http://localhost/api/roadmap/items");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    const itemA = body.items.find((i: any) => i.id === "a");
    const itemB = body.items.find((i: any) => i.id === "b");
    expect(itemA.viewer_has_voted).toBe(true);
    expect(itemB.viewer_has_voted).toBe(false);
  });

  it("applies status filter when valid", async () => {
    const viewBuilder = makeBuilder({ data: [], error: null });
    mockServiceRoleClient.from.mockReturnValue(viewBuilder);
    mockAPIServerClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = new Request("http://localhost/api/roadmap/items?status=shipped");
    await GET(req);

    expect(viewBuilder.eq).toHaveBeenCalledWith("status", "shipped");
  });

  it("ignores invalid status filter", async () => {
    const viewBuilder = makeBuilder({ data: [], error: null });
    mockServiceRoleClient.from.mockReturnValue(viewBuilder);
    mockAPIServerClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = new Request("http://localhost/api/roadmap/items?status=pizza");
    await GET(req);

    expect(viewBuilder.eq).not.toHaveBeenCalled();
  });

  it("returns 500 on view query error", async () => {
    const viewBuilder = makeBuilder({ data: null, error: { message: "db fail" } });
    mockServiceRoleClient.from.mockReturnValue(viewBuilder);
    mockAPIServerClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = new Request("http://localhost/api/roadmap/items");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("db fail");
  });

  it("calls order chain in correct sequence", async () => {
    const viewBuilder = makeBuilder({ data: [], error: null });
    mockServiceRoleClient.from.mockReturnValue(viewBuilder);
    mockAPIServerClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = new Request("http://localhost/api/roadmap/items");
    await GET(req);

    const orderCalls = viewBuilder.order.mock.calls;
    expect(orderCalls).toHaveLength(3);
    expect(orderCalls[0]).toEqual(["vote_count", { ascending: false }]);
    expect(orderCalls[1]).toEqual(["shipped_at", { ascending: false, nullsFirst: false }]);
    expect(orderCalls[2]).toEqual(["created_at", { ascending: false }]);
  });
});
