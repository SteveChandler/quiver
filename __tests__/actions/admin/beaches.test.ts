/**
 * @jest-environment node
 */

import { createThenableQuery } from "@/__tests__/setup/admin-action-test-utils";

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

// Stubbed so this suite asserts the write-path WIRING (that the canonical
// resolver is called with the right coordinates and its result is persisted).
// geo-tz's actual resolution is covered in __tests__/lib/utils/timezone-utils.test.ts,
// and loading its full dataset here keeps a Jest worker alive after teardown.
jest.mock("@/lib/utils/timezone-utils.server", () => ({
  findCanonicalTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

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

  // Regression guards for the 2026-08-20 timezone incident: beaches.timezone is
  // NOT NULL with no default, and a beach that moves can move across a zone
  // boundary. Both write paths must resolve it from the coordinates being
  // written, using the CANONICAL resolver (not the offset-merged one).

  async function arrangeBeachWrite(timezone: string, existing?: unknown) {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { findCanonicalTimezoneFromCoords } = await import(
      "@/lib/utils/timezone-utils.server"
    );

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });
    (findCanonicalTimezoneFromCoords as jest.Mock).mockReturnValue(timezone);

    const write = createThenableQuery<any>({ data: { id: "b1" }, error: null });
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: existing
        ? jest
            .fn()
            .mockImplementationOnce(() =>
              createThenableQuery<any>({ data: existing, error: null })
            )
            .mockImplementationOnce(() => write)
        : jest.fn(() => write),
    });

    return { write, resolve: findCanonicalTimezoneFromCoords as jest.Mock };
  }

  const beachForm = (overrides: Record<string, unknown>) => ({
    name: "Test",
    location: "Somewhere",
    region: "Somewhere",
    country: "usa",
    break_type: "beach",
    skill_level: "beginner",
    is_private: false,
    hazards: [],
    ...overrides,
  });

  test("createBeach persists a timezone resolved from the coordinates", async () => {
    const { write, resolve } = await arrangeBeachWrite("America/Chicago");

    const { createBeach } = await import("@/actions/admin/beaches");
    const res = await createBeach(
      beachForm({ latitude: 29.26477, longitude: -94.82505 })
    );

    expect(res.success).toBe(true);
    expect(resolve).toHaveBeenCalledWith(29.26477, -94.82505);
    // Not the column default: that silent default is what broke the Gulf Coast.
    expect(write.insert).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: "America/Chicago" })
    );
  });

  test("updateBeach recomputes the timezone when the beach moves", async () => {
    const { write, resolve } = await arrangeBeachWrite("America/Chicago", {
      name: "Old",
      region: "Old Region",
      lat: 32.7,
      lon: -117.2,
    });

    const { updateBeach } = await import("@/actions/admin/beaches");
    const res = await updateBeach(
      "b1",
      beachForm({ latitude: 29.26477, longitude: -94.82505 })
    );

    expect(res.success).toBe(true);
    expect(resolve).toHaveBeenCalledWith(29.26477, -94.82505);
    expect(write.update).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: "America/Chicago" })
    );
  });

  test("updateBeach resolves a lat-only move against the stored longitude", async () => {
    const { write, resolve } = await arrangeBeachWrite("America/New_York", {
      name: "Old",
      region: "Old Region",
      lat: 40.6,
      lon: -73.25,
    });

    const { updateBeach } = await import("@/actions/admin/beaches");
    const res = await updateBeach(
      "b1",
      beachForm({ latitude: 40.62, longitude: null }) as any
    );

    expect(res.success).toBe(true);
    // The longitude came from the stored row, not from the form.
    expect(resolve).toHaveBeenCalledWith(40.62, -73.25);
    expect(write.update).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: "America/New_York" })
    );
  });
});


