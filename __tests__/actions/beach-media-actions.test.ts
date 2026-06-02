/**
 * @jest-environment node
 */

import { createThenableQuery } from "@/__tests__/setup/admin-action-test-utils";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

describe("beach media actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("returns approved beach photos from beach_photos", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const query = createThenableQuery<any[]>({
      data: [
        {
          id: "bp1",
          image_url: "https://cdn.example.com/full.jpg",
          thumb_url: "https://cdn.example.com/thumb.jpg?format=json",
          fetched_at: "2026-06-01T00:00:00Z",
        },
      ],
      error: null,
    });
    const from = jest.fn(() => query);

    (createSupabaseServerClient as jest.Mock).mockResolvedValue({ from });

    const { getBestBeachPhotosAction } = await import("@/actions/beach-media-actions");
    const res = await getBestBeachPhotosAction("beach-1", 6);

    expect(res.success).toBe(true);
    expect(res.data).toEqual([
      {
        id: "bp1",
        created_at: "2026-06-01T00:00:00Z",
        public_url: "https://cdn.example.com/thumb.jpg",
      },
    ]);
    expect(from).toHaveBeenCalledWith("beach_photos");
    expect(query.eq).toHaveBeenCalledWith("approved", true);
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  test("does not fall back to raw session_media when no approved beach photos exist", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const query = createThenableQuery<any[]>({
      data: [],
      error: null,
    });
    const from = jest.fn(() => query);

    (createSupabaseServerClient as jest.Mock).mockResolvedValue({ from });

    const { getBestBeachPhotosAction } = await import("@/actions/beach-media-actions");
    const res = await getBestBeachPhotosAction("beach-1", 6);

    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("beach_photos");
  });
});
