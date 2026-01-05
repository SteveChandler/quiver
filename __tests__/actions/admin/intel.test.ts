/**
 * @jest-environment node
 */

jest.mock("@/lib/auth/admin", () => ({
  getCurrentUser: jest.fn(),
  assertIsAdmin: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/logging/admin-audit", () => ({
  recordAdminEvent: jest.fn().mockResolvedValue({ success: true }),
}));

import { createThenableQuery, QueryResult } from "./test-utils";

describe("admin intel actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("listIntelPosts filters inactive by default", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const query = createThenableQuery<any[]>({ data: [], error: null });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => query),
    });

    const { listIntelPosts } = await import("@/actions/admin/intel");

    const res = await listIntelPosts({});
    if (!res.success) {
      throw new Error(res.error || "listIntelPosts failed");
    }
    expect(res.success).toBe(true);
    expect(query.eq).toHaveBeenCalledWith("is_active", true);

    const resInclude = await listIntelPosts({ includeInactive: true });
    expect(resInclude.success).toBe(true);
  });

  test("getIntelStats aggregates counts and tags safely", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const activeCountQuery = createThenableQuery<any>({
      data: null,
      error: null,
      count: 2,
    });
    const inactiveCountQuery = createThenableQuery<any>({
      data: null,
      error: null,
      count: 1,
    });
    const tagQuery = createThenableQuery<any[]>({
      data: [{ tag: "parking" }, { tag: "hazard" }, { tag: "parking" }],
      error: null,
    });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest
        .fn()
        .mockImplementationOnce(() => activeCountQuery)
        .mockImplementationOnce(() => inactiveCountQuery)
        .mockImplementationOnce(() => tagQuery),
    });

    const { getIntelStats } = await import("@/actions/admin/intel");
    const res = await getIntelStats();

    expect(res.success).toBe(true);
    expect(res.data).toEqual({
      totalActive: 2,
      totalInactive: 1,
      total: 3,
      byTag: expect.objectContaining({
        parking: 2,
        hazard: 1,
      }),
    });
  });

  test("toggleIntelActive validates input, updates record, and logs audit event", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { recordAdminEvent } = await import("@/lib/logging/admin-audit");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const intelPostId = "11111111-1111-4111-8111-111111111111";

    const fetchQuery = createThenableQuery<any>({
      data: { id: intelPostId, title: "T", tag: "parking", beach_id: "b1", user_id: "u1", is_active: false },
      error: null,
    });
    const updateQuery = createThenableQuery<any>({
      data: { id: intelPostId, is_active: true },
      error: null,
    });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest
        .fn()
        .mockImplementationOnce(() => fetchQuery)
        .mockImplementationOnce(() => updateQuery),
    });

    const { toggleIntelActive } = await import("@/actions/admin/intel");
    const res = await toggleIntelActive({ intelPostId, isActive: true });
    if (!res.success) {
      throw new Error(res.error || "toggleIntelActive failed");
    }

    expect(res.success).toBe(true);
    expect(recordAdminEvent).toHaveBeenCalledWith(
      "admin-1",
      "intel",
      "activate",
      expect.objectContaining({ entityId: intelPostId })
    );
  });

  test("updateIntelContent validates input, updates content, and logs audit diff", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { recordAdminEvent } = await import("@/lib/logging/admin-audit");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const intelPostId = "11111111-1111-4111-8111-111111111111";

    const fetchQuery = createThenableQuery<any>({
      data: { id: intelPostId, title: "Old", description: "Old desc", tag: "other" },
      error: null,
    });
    const updateQuery = createThenableQuery<any>({
      data: { id: intelPostId, title: "New", description: "New desc", tag: "parking" },
      error: null,
    });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest
        .fn()
        .mockImplementationOnce(() => fetchQuery)
        .mockImplementationOnce(() => updateQuery),
    });

    const { updateIntelContent } = await import("@/actions/admin/intel");
    const res = await updateIntelContent({
      intelPostId,
      title: "New",
      description: "New desc",
      tag: "parking",
    });
    if (!res.success) {
      throw new Error(res.error || "updateIntelContent failed");
    }

    expect(res.success).toBe(true);
    expect(recordAdminEvent).toHaveBeenCalledWith(
      "admin-1",
      "intel",
      "update",
      expect.objectContaining({
        entityId: intelPostId,
        payloadSummary: expect.objectContaining({
          changes: expect.any(Object),
        }),
      })
    );
  });

  test("toggleIntelActive rejects invalid input (zod)", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({ from: jest.fn() });

    const { toggleIntelActive } = await import("@/actions/admin/intel");
    const res = await toggleIntelActive({ intelPostId: "", isActive: "yes" } as any);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/intelPostId|isActive/i);
  });
});


