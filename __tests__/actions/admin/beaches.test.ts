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

describe("admin beaches actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("listBeaches excludes soft-deleted by default", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const query = createThenableQuery<any[]>({ data: [], error: null });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => query),
    });

    const { listBeaches } = await import("@/actions/admin/beaches");
    const res = await listBeaches({});

    expect(res.success).toBe(true);
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  test("getBeachForEdit returns error when Supabase errors", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const query = createThenableQuery<any>({
      data: null,
      error: { message: "db err" },
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => query),
    });

    const { getBeachForEdit } = await import("@/actions/admin/beaches");
    const res = await getBeachForEdit("beach-1");

    expect(res.success).toBe(false);
    expect(res.error).toBe("Failed to fetch beach: db err");
  });

  test("createBeach validates input and logs audit event", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { recordAdminEvent } = await import("@/lib/logging/admin-audit");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const createdRow = { id: "b1", name: "New Beach" };
    const insertQuery = createThenableQuery<any>({
      data: createdRow,
      error: null,
    });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => insertQuery),
    });

    const { createBeach } = await import("@/actions/admin/beaches");
    const res = await createBeach({
      name: "New Beach",
      location: "Somewhere",
      region: "San Diego",
      country: "usa",
      latitude: 32.7,
      longitude: -117.2,
      break_type: "beach",
      skill_level: "beginner",
      is_private: false,
      hazards: ["rocks"],
    });

    expect(res.success).toBe(true);
    expect(res.data?.id).toBe("b1");
    expect(recordAdminEvent).toHaveBeenCalledWith(
      "admin-1",
      "beach",
      "create",
      expect.objectContaining({
        entityId: "b1",
        description: expect.stringContaining("Created beach"),
      })
    );
  });

  test("createBeach rejects invalid input (zod)", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(),
    });

    const { createBeach } = await import("@/actions/admin/beaches");
    const res = await createBeach({ name: "" } as any);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/name/i);
  });

  test("updateBeach logs audit event with previous values", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { recordAdminEvent } = await import("@/lib/logging/admin-audit");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const existingQuery = createThenableQuery<any>({
      data: { name: "Old", region: "Old Region" },
      error: null,
    });

    const updateQuery = createThenableQuery<any>({
      data: { id: "b1", name: "New", region: "New Region" },
      error: null,
    });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest
        .fn()
        .mockImplementationOnce(() => existingQuery)
        .mockImplementationOnce(() => updateQuery),
    });

    const { updateBeach } = await import("@/actions/admin/beaches");
    const res = await updateBeach("b1", {
      name: "New",
      location: "Somewhere",
      region: "New Region",
      country: "usa",
      latitude: 32.7,
      longitude: -117.2,
      break_type: "beach",
      skill_level: "beginner",
      is_private: false,
      hazards: ["rocks"],
    });

    expect(res.success).toBe(true);
    expect(recordAdminEvent).toHaveBeenCalledWith(
      "admin-1",
      "beach",
      "update",
      expect.objectContaining({
        entityId: "b1",
        payloadSummary: expect.objectContaining({
          previous_name: "Old",
          previous_region: "Old Region",
        }),
      })
    );
  });

  test("softDeleteBeach and restoreBeach log audit events", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { recordAdminEvent } = await import("@/lib/logging/admin-audit");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const fetchBeach = createThenableQuery<any>({ data: { name: "X", region: "R" }, error: null });
    const updateSoftDelete = createThenableQuery<any>({ data: null, error: null });

    const fetchBeach2 = createThenableQuery<any>({ data: { name: "X", region: "R" }, error: null });
    const updateRestore = createThenableQuery<any>({ data: null, error: null });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest
        .fn()
        .mockImplementationOnce(() => fetchBeach)
        .mockImplementationOnce(() => updateSoftDelete)
        .mockImplementationOnce(() => fetchBeach2)
        .mockImplementationOnce(() => updateRestore),
    });

    const { softDeleteBeach, restoreBeach } = await import("@/actions/admin/beaches");

    const delRes = await softDeleteBeach("b1");
    expect(delRes.success).toBe(true);
    expect(recordAdminEvent).toHaveBeenCalledWith(
      "admin-1",
      "beach",
      "delete",
      expect.objectContaining({ entityId: "b1" })
    );

    const restoreRes = await restoreBeach("b1");
    expect(restoreRes.success).toBe(true);
    expect(recordAdminEvent).toHaveBeenCalledWith(
      "admin-1",
      "beach",
      "restore",
      expect.objectContaining({ entityId: "b1" })
    );
  });
});


