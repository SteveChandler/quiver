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

describe("admin photos actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("listSessionMedia excludes deleted by default and supports search", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const query = createThenableQuery<any[]>({
      data: [
        {
          id: "m1",
          user_id: "u1",
          session_id: "s1",
          storage_path: "p1.jpg",
          public_url: "https://example.com/p1.jpg",
          file_size: 10,
          caption: "Nice",
          created_at: "2025-01-01T00:00:00Z",
          deleted_at: null,
          profiles: { display_name: "Alice", email: "a@example.com" },
        },
      ] as any,
      error: null,
    });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => query),
    });

    const { listSessionMedia } = await import("@/actions/admin/photos");
    const res = await listSessionMedia({ search: "nice" });

    expect(res.success).toBe(true);
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(query.or).toHaveBeenCalledWith("caption.ilike.%nice%");
    expect(res.data?.[0]).toEqual(
      expect.objectContaining({
        id: "m1",
        type: "session_media",
        imageUrl: "https://example.com/p1.jpg",
        status: "active",
      })
    );
  });

  test("softDeleteSessionMedia marks deleted, attempts storage cleanup, logs audit event", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { recordAdminEvent } = await import("@/lib/logging/admin-audit");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const fetchQuery = createThenableQuery<any>({
      data: { storage_path: "path.jpg", caption: "c", user_id: "u1", file_size: 12 },
      error: null,
    });
    const updateQuery = createThenableQuery<any>({
      data: null,
      error: null,
    });

    const storageRemove = jest.fn().mockResolvedValue({ error: null });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest
        .fn()
        .mockImplementationOnce(() => fetchQuery)
        .mockImplementationOnce(() => updateQuery),
      storage: {
        from: jest.fn(() => ({
          remove: storageRemove,
        })),
      },
    });

    const { softDeleteSessionMedia } = await import("@/actions/admin/photos");
    const res = await softDeleteSessionMedia("m1");

    expect(res.success).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith(["path.jpg"]);
    expect(recordAdminEvent).toHaveBeenCalledWith(
      "admin-1",
      "photo",
      "delete",
      expect.objectContaining({ entityId: "m1" })
    );
  });

  test("restoreSessionMedia updates deleted_at=null and logs audit", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { recordAdminEvent } = await import("@/lib/logging/admin-audit");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const fetchQuery = createThenableQuery<any>({ data: { caption: "c", user_id: "u1" }, error: null });
    const updateQuery = createThenableQuery<any>({ data: null, error: null });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementationOnce(() => fetchQuery).mockImplementationOnce(() => updateQuery),
    });

    const { restoreSessionMedia } = await import("@/actions/admin/photos");
    const res = await restoreSessionMedia("m1");

    expect(res.success).toBe(true);
    expect(recordAdminEvent).toHaveBeenCalledWith(
      "admin-1",
      "photo",
      "restore",
      expect.objectContaining({ entityId: "m1" })
    );
  });

  test("bulkSoftDeleteSessionMedia tracks failures for missing items", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const fetchMissing = createThenableQuery<any>({ data: null, error: null });
    const fetchOk = createThenableQuery<any>({
      data: { storage_path: "p.jpg", caption: "c", user_id: "u1", file_size: 1 },
      error: null,
    });
    const updateOk = createThenableQuery<any>({ data: null, error: null });

    const storageRemove = jest.fn().mockResolvedValue({ error: null });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest
        .fn()
        .mockImplementationOnce(() => fetchMissing)
        .mockImplementationOnce(() => fetchOk)
        .mockImplementationOnce(() => updateOk),
      storage: {
        from: jest.fn(() => ({ remove: storageRemove })),
      },
    });

    const { bulkSoftDeleteSessionMedia } = await import("@/actions/admin/photos");
    const res = await bulkSoftDeleteSessionMedia(["m-missing", "m-ok"]);

    expect(res.success).toBe(true);
    expect(res.data).toEqual(
      expect.objectContaining({
        success: 1,
        failed: 1,
        errors: [{ id: "m-missing", error: "Media not found" }],
      })
    );
  });

  test("listBeachPhotos supports approvedOnly and search", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const query = createThenableQuery<any[]>({
      data: [
        {
          id: "p1",
          beach_id: "b1",
          source: "x",
          image_url: "https://example.com/i.jpg",
          thumb_url: "https://example.com/t.jpg",
          title: "Sunset",
          creator_name: "Someone",
          approved: true,
          fetched_at: "2025-01-01T00:00:00Z",
          deleted_at: null,
          beaches: { name: "Beach" },
        },
      ] as any,
      error: null,
    });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => query),
    });

    const { listBeachPhotos } = await import("@/actions/admin/photos");
    const res = await listBeachPhotos({ approvedOnly: true, search: "sun" });

    expect(res.success).toBe(true);
    expect(query.eq).toHaveBeenCalledWith("approved", true);
    expect(query.or).toHaveBeenCalledWith("title.ilike.%sun%,creator_name.ilike.%sun%");
    expect(res.data?.[0]).toEqual(expect.objectContaining({ type: "beach_photo", approved: true }));
  });

  test("toggleBeachPhotoApproval updates approval and logs audit event", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { recordAdminEvent } = await import("@/lib/logging/admin-audit");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const fetchQuery = createThenableQuery<any>({
      data: { title: "T", source: "S", beach_id: "b1", beaches: { name: "B" } },
      error: null,
    });
    const updateQuery = createThenableQuery<any>({ data: null, error: null });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockImplementationOnce(() => fetchQuery).mockImplementationOnce(() => updateQuery),
    });

    const { toggleBeachPhotoApproval } = await import("@/actions/admin/photos");
    const res = await toggleBeachPhotoApproval("p1", true);

    expect(res.success).toBe(true);
    expect(recordAdminEvent).toHaveBeenCalledWith(
      "admin-1",
      "photo",
      "approve",
      expect.objectContaining({ entityId: "p1" })
    );
  });

  test("getPhotoStats returns counts with nulls handled as 0", async () => {
    const { getCurrentUser } = await import("@/lib/auth/admin");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

    const q1 = createThenableQuery<any>({ data: null, error: null, count: 10 });
    const q2 = createThenableQuery<any>({ data: null, error: null, count: 2 });
    const q3 = createThenableQuery<any>({ data: null, error: null, count: 5 });
    const q4 = createThenableQuery<any>({ data: null, error: null, count: 3 });
    const q5 = createThenableQuery<any>({ data: null, error: null, count: 1 });
    const q6 = createThenableQuery<any>({ data: null, error: null, count: 1 });

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest
        .fn()
        .mockImplementationOnce(() => q1)
        .mockImplementationOnce(() => q2)
        .mockImplementationOnce(() => q3)
        .mockImplementationOnce(() => q4)
        .mockImplementationOnce(() => q5)
        .mockImplementationOnce(() => q6),
    });

    const { getPhotoStats } = await import("@/actions/admin/photos");
    const res = await getPhotoStats({});

    expect(res.success).toBe(true);
    expect(res.data).toEqual({
      sessionMedia: { total: 10, deleted: 2 },
      beachPhotos: { total: 5, approved: 3, pending: 1, deleted: 1 },
    });
  });
});



