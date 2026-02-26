/**
 * @jest-environment node
 */

import type { Beach } from "@/types/database";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

type SupabaseQueryResponse<T> = { data: T; error: { message: string } | null };

function createBeachesQueryMock(args: {
  response: SupabaseQueryResponse<Beach[] | null>;
  onEq?: (field: string, value: string) => void;
}) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn((field: string, value: string) => {
        args.onEq?.(field, value);
        return {
          limit: jest.fn(async (_n: number) => args.response),
        };
      }),
    })),
  };
}

function createFeaturedPhotoQueryMock(args: {
  response: SupabaseQueryResponse<any>;
}) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn((_field: string, _value: string) => ({
        maybeSingle: jest.fn(async () => args.response),
      })),
    })),
  };
}

function createBeachPhotosFallbackQueryMock(args: {
  response: SupabaseQueryResponse<any>;
}) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn((_field1: string, _value1: string) => ({
        eq: jest.fn((_field2: string, _value2: any) => ({
          order: jest.fn((_field3: string, _opts: any) => ({
            limit: jest.fn((_n: number) => ({
              maybeSingle: jest.fn(async () => args.response),
            })),
          })),
        })),
      })),
    })),
  };
}

function createBeachPhotosGalleryQueryMock(args: {
  response: SupabaseQueryResponse<any[] | null>;
}) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn((_field1: string, _value1: string) => ({
        eq: jest.fn((_field2: string, _value2: any) => ({
          order: jest.fn((_field3: string, _opts: any) => ({
            limit: jest.fn(async (_n: number) => args.response),
          })),
        })),
      })),
    })),
  };
}

describe("spot-data-actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe("getSpotDataBySlug", () => {
    test('normalizes slug (" Blacks " -> "blacks") and queries DB with normalized slug', async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const onEq = jest.fn();

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((_table: string) =>
          createBeachesQueryMock({
            response: { data: [], error: null },
            onEq,
          })
        ),
      });

      const { getSpotDataBySlug } = await import("@/actions/spot/spot-data-actions");
      await getSpotDataBySlug(" Blacks ");

      expect(onEq).toHaveBeenCalledWith("slug", "blacks");
    });

    test("returns merged DB + static data when both exist (DB id/coords win, static content wins)", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      const beachRow = {
        id: "beach-db-1",
        slug: "blacks",
        name: "Blacks Beach (DB)",
        lat: 1.23,
        lon: 4.56,
        city: "La Jolla",
        state: "CA",
        description: "DB description",
        break_type: "reef",
        skill_level: "Advanced",
        hazards: ["rocks"],
        features: ["parking"],
        parking_tips: "DB parking tips",
        best_conditions_prose: "DB best conditions",
      } as unknown as Beach;

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((_table: string) =>
          createBeachesQueryMock({
            response: { data: [beachRow], error: null },
          })
        ),
      });

      const { getSpotDataBySlug } = await import("@/actions/spot/spot-data-actions");
      const { data: result, dbHasLocation } = await getSpotDataBySlug("blacks");

      expect(result).toBeTruthy();
      expect(result?.id).toBe("beach-db-1"); // DB id wins
      expect(result?.latitude).toBe(1.23); // DB coords win
      expect(result?.longitude).toBe(4.56);

      // Static content should exist (real SURF_SPOTS entry)
      expect(result?.history).toBeTruthy();
      expect(result?.tideAdvice).toBeTruthy();

      // Static description (overview) wins over DB description
      expect(result?.description).not.toBe("DB description");

      // dbHasLocation should be true since DB record has city and state
      expect(dbHasLocation).toBe(true);
    });

    test("returns static-only data when DB miss", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((_table: string) =>
          createBeachesQueryMock({
            response: { data: [], error: null },
          })
        ),
      });

      const { getSpotDataBySlug } = await import("@/actions/spot/spot-data-actions");
      const { data: result, dbHasLocation } = await getSpotDataBySlug("blacks");

      expect(result).toBeTruthy();
      expect(result?.id).toBeNull(); // static entry has no id
      expect(result?.slug).toBe("blacks");
      expect(result?.history).toBeTruthy();
      expect(result?.latitude).toBeCloseTo(32.8851, 4);

      // dbHasLocation should be false since no DB record
      expect(dbHasLocation).toBe(false);
    });

    test("returns null when both DB + static miss", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((_table: string) =>
          createBeachesQueryMock({
            response: { data: [], error: null },
          })
        ),
      });

      const { getSpotDataBySlug } = await import("@/actions/spot/spot-data-actions");
      const { data: result, dbHasLocation } = await getSpotDataBySlug("definitely-not-a-spot");

      expect(result).toBeNull();
      expect(dbHasLocation).toBe(false);
    });

    test("dbHasLocation is false when city is whitespace-only", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      const beachRow = {
        id: "beach-whitespace-city",
        slug: "test-beach",
        name: "Test Beach",
        lat: 32.0,
        lon: -117.0,
        city: "   ", // whitespace only
        state: "CA",
      } as unknown as Beach;

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((_table: string) =>
          createBeachesQueryMock({
            response: { data: [beachRow], error: null },
          })
        ),
      });

      const { getSpotDataBySlug } = await import("@/actions/spot/spot-data-actions");
      const { data: result, dbHasLocation } = await getSpotDataBySlug("test-beach");

      expect(result).toBeTruthy();
      expect(result?.id).toBe("beach-whitespace-city");
      // dbHasLocation should be false because city is whitespace-only
      expect(dbHasLocation).toBe(false);
    });

    test("dbHasLocation is false when state is empty string", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      const beachRow = {
        id: "beach-empty-state",
        slug: "test-beach-2",
        name: "Test Beach 2",
        lat: 32.0,
        lon: -117.0,
        city: "San Diego",
        state: "", // empty string
      } as unknown as Beach;

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((_table: string) =>
          createBeachesQueryMock({
            response: { data: [beachRow], error: null },
          })
        ),
      });

      const { getSpotDataBySlug } = await import("@/actions/spot/spot-data-actions");
      const { data: result, dbHasLocation } = await getSpotDataBySlug("test-beach-2");

      expect(result).toBeTruthy();
      expect(result?.id).toBe("beach-empty-state");
      // dbHasLocation should be false because state is empty
      expect(dbHasLocation).toBe(false);
    });

    test("dbHasLocation is false when city is null but state exists", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      const beachRow = {
        id: "beach-null-city",
        slug: "test-beach-3",
        name: "Test Beach 3",
        lat: 32.0,
        lon: -117.0,
        city: null, // null
        state: "CA",
      } as unknown as Beach;

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((_table: string) =>
          createBeachesQueryMock({
            response: { data: [beachRow], error: null },
          })
        ),
      });

      const { getSpotDataBySlug } = await import("@/actions/spot/spot-data-actions");
      const { data: result, dbHasLocation } = await getSpotDataBySlug("test-beach-3");

      expect(result).toBeTruthy();
      expect(result?.id).toBe("beach-null-city");
      // dbHasLocation should be false because city is null
      expect(dbHasLocation).toBe(false);
    });

    test("dbHasLocation is false when both city and state are missing", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      const beachRow = {
        id: "beach-no-location",
        slug: "test-beach-4",
        name: "Test Beach 4",
        lat: 32.0,
        lon: -117.0,
        city: null,
        state: null,
      } as unknown as Beach;

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((_table: string) =>
          createBeachesQueryMock({
            response: { data: [beachRow], error: null },
          })
        ),
      });

      const { getSpotDataBySlug } = await import("@/actions/spot/spot-data-actions");
      const { data: result, dbHasLocation } = await getSpotDataBySlug("test-beach-4");

      expect(result).toBeTruthy();
      expect(result?.id).toBe("beach-no-location");
      // dbHasLocation should be false because both are missing
      expect(dbHasLocation).toBe(false);
    });
  });

  describe("getSpotFeaturedPhoto", () => {
    test("uses beach_photos_featured when present", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === "beach_photos_featured") {
            return createFeaturedPhotoQueryMock({
              response: {
                data: {
                  image_url: "https://example.com/featured.jpg",
                  thumb_url: "https://example.com/featured-thumb.jpg",
                  attribution_html: "<p>credit</p>",
                },
                error: null,
              },
            });
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      });

      const { getSpotFeaturedPhoto } = await import("@/actions/spot/spot-data-actions");
      const result = await getSpotFeaturedPhoto("beach-1");

      expect(result).toEqual({
        imageUrl: "https://example.com/featured.jpg",
        thumbUrl: "https://example.com/featured-thumb.jpg",
        attributionHtml: "<p>credit</p>",
        title: null,
        creatorName: null,
      });
    });

    test("falls back to latest approved beach_photos when featured view missing", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === "beach_photos_featured") {
            return createFeaturedPhotoQueryMock({
              response: { data: null, error: { message: "view missing" } },
            });
          }
          if (table === "beach_photos") {
            return createBeachPhotosFallbackQueryMock({
              response: {
                data: {
                  image_url: "https://example.com/fallback.jpg",
                  thumb_url: null,
                  attribution_html: null,
                  title: null,
                  creator_name: null,
                },
                error: null,
              },
            });
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      });

      const { getSpotFeaturedPhoto } = await import("@/actions/spot/spot-data-actions");
      const result = await getSpotFeaturedPhoto("beach-1");

      expect(result).toEqual({
        imageUrl: "https://example.com/fallback.jpg",
        thumbUrl: null,
        attributionHtml: null,
        title: null,
        creatorName: null,
      });
    });

    test("returns null cleanly when both featured + fallback missing (no throw)", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === "beach_photos_featured") {
            return createFeaturedPhotoQueryMock({
              response: { data: null, error: { message: "view missing" } },
            });
          }
          if (table === "beach_photos") {
            return createBeachPhotosFallbackQueryMock({
              response: { data: null, error: null },
            });
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      });

      const { getSpotFeaturedPhoto } = await import("@/actions/spot/spot-data-actions");
      await expect(getSpotFeaturedPhoto("beach-1")).resolves.toBeNull();
    });
  });

  describe("getSpotGalleryPhotos", () => {
    test("returns [] on query error (no throw)", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === "beach_photos") {
            return createBeachPhotosGalleryQueryMock({
              response: { data: null, error: { message: "db down" } },
            });
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      });

      const { getSpotGalleryPhotos } = await import("@/actions/spot/spot-data-actions");
      await expect(getSpotGalleryPhotos("beach-1", 3)).resolves.toEqual([]);
    });

    test("returns mapped rows when present", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");

      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table === "beach_photos") {
            return createBeachPhotosGalleryQueryMock({
              response: {
                data: [
                  {
                    image_url: "https://example.com/1.jpg",
                    thumb_url: null,
                    attribution_html: null,
                    title: "One",
                    creator_name: "A",
                  },
                  {
                    image_url: "https://example.com/2.jpg",
                    thumb_url: "https://example.com/2t.jpg",
                    attribution_html: "<p>x</p>",
                    title: null,
                    creator_name: null,
                  },
                ],
                error: null,
              },
            });
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      });

      const { getSpotGalleryPhotos } = await import("@/actions/spot/spot-data-actions");
      const result = await getSpotGalleryPhotos("beach-1", 6);

      expect(result).toEqual([
        {
          imageUrl: "https://example.com/1.jpg",
          thumbUrl: null,
          attributionHtml: null,
          title: "One",
          creatorName: "A",
        },
        {
          imageUrl: "https://example.com/2.jpg",
          thumbUrl: "https://example.com/2t.jpg",
          attributionHtml: "<p>x</p>",
          title: null,
          creatorName: null,
        },
      ]);
    });
  });
});






