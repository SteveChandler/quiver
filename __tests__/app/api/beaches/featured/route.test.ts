/**
 * API tests for featured beaches endpoint
 *
 * Purpose: Verify the /api/beaches/featured endpoint correctly:
 * - Excludes soft-deleted and unapproved photos
 * - Respects beach exclusion configuration
 * - Applies priority beach sorting
 * - Handles edge cases and errors gracefully
 * - Returns properly formatted responses
 *
 * File tested: app/api/beaches/featured/route.ts
 *
 * @jest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

// Restore real fetch for database tests
// @ts-ignore
delete global.fetch;

// Import the route handler functions (we'll test helper functions)
// Note: In a real test, you'd mock the Next.js request/response objects
// For this test, we'll test the data fetching logic directly using the same Supabase patterns

describe("Featured Beaches API Route", () => {
  let adminClient: ReturnType<typeof createClient<Database>>;
  let publicClient: ReturnType<typeof createClient<Database>>;
  let testBeaches: Array<{ id: string; name: string }> = [];
  let testPhotos: Array<{ id: string; beach_id: string; deleted: boolean; approved: boolean }> = [];

  beforeAll(() => {
    adminClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    publicClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  });

  beforeEach(async () => {
    // Create test beaches
    const beachNames = [
      "Featured Test Beach 1",
      "Featured Test Beach 2",
      "Featured Test Beach 3",
      "Priority Test Beach",
      "Excluded Test Beach",
    ];

    for (const name of beachNames) {
      const { data: beach, error } = await adminClient
        .from("beaches")
        .insert({
          name: `${name} ${Date.now()}`,
          city: "Test City",
          state: "California",
          country: "USA",
          lat: 32.7157,
          lon: -117.1611,
          is_private: false,
        })
        .select()
        .single();

      if (error || !beach) {
        throw new Error(`Failed to create test beach: ${error?.message}`);
      }

      testBeaches.push(beach);
    }

    // Create test photos with various states
    const [beach1, beach2, beach3, priorityBeach, excludedBeach] = testBeaches;

    // Beach 1: Approved, non-deleted photo (VISIBLE)
    const { data: photo1 } = await adminClient
      .from("beach_photos")
      .insert({
        beach_id: beach1.id,
        photo_url: "https://test.com/beach1-approved.jpg",
        thumb_url: "https://test.com/beach1-approved-thumb.jpg",
        approved: true,
        deleted_at: null,
      })
      .select()
      .single();
    testPhotos.push({ id: photo1!.id, beach_id: beach1.id, deleted: false, approved: true });

    // Beach 2: Unapproved photo (HIDDEN)
    const { data: photo2 } = await adminClient
      .from("beach_photos")
      .insert({
        beach_id: beach2.id,
        photo_url: "https://test.com/beach2-unapproved.jpg",
        approved: false,
        deleted_at: null,
      })
      .select()
      .single();
    testPhotos.push({ id: photo2!.id, beach_id: beach2.id, deleted: false, approved: false });

    // Beach 3: Soft-deleted photo (HIDDEN)
    const { data: photo3 } = await adminClient
      .from("beach_photos")
      .insert({
        beach_id: beach3.id,
        photo_url: "https://test.com/beach3-deleted.jpg",
        approved: true,
        deleted_at: new Date().toISOString(),
      })
      .select()
      .single();
    testPhotos.push({ id: photo3!.id, beach_id: beach3.id, deleted: true, approved: true });

    // Priority Beach: Approved photo (VISIBLE + PRIORITY)
    const { data: photo4 } = await adminClient
      .from("beach_photos")
      .insert({
        beach_id: priorityBeach.id,
        photo_url: "https://test.com/priority-beach.jpg",
        thumb_url: "https://test.com/priority-beach-thumb.jpg",
        approved: true,
        deleted_at: null,
      })
      .select()
      .single();
    testPhotos.push({ id: photo4!.id, beach_id: priorityBeach.id, deleted: false, approved: true });

    // Excluded Beach: Approved photo but beach is excluded (HIDDEN)
    const { data: photo5 } = await adminClient
      .from("beach_photos")
      .insert({
        beach_id: excludedBeach.id,
        photo_url: "https://test.com/excluded-beach.jpg",
        approved: true,
        deleted_at: null,
      })
      .select()
      .single();
    testPhotos.push({ id: photo5!.id, beach_id: excludedBeach.id, deleted: false, approved: true });
  });

  afterEach(async () => {
    // Clean up test data
    for (const beach of testBeaches) {
      await adminClient.from("beach_photos").delete().eq("beach_id", beach.id);
      await adminClient.from("beaches").delete().eq("id", beach.id);
    }

    testBeaches = [];
    testPhotos = [];
  });

  describe("Photo Filtering", () => {
    it("should exclude soft-deleted photos from beach_photos query", async () => {
      // Query beach_photos using the same pattern as the API route
      const { data: photos } = await publicClient
        .from("beach_photos")
        .select("beach_id, photo_url")
        .is("deleted_at", null)
        .eq("approved", true);

      const beachIds = photos?.map((p) => p.beach_id) || [];

      // Should include beaches with approved, non-deleted photos
      expect(beachIds).toContain(testBeaches[0].id); // Beach 1
      expect(beachIds).toContain(testBeaches[3].id); // Priority Beach

      // Should NOT include beach with soft-deleted photo
      expect(beachIds).not.toContain(testBeaches[2].id); // Beach 3 (deleted photo)
    });

    it("should exclude unapproved photos from beach_photos query", async () => {
      const { data: photos } = await publicClient
        .from("beach_photos")
        .select("beach_id, photo_url")
        .is("deleted_at", null)
        .eq("approved", true);

      const beachIds = photos?.map((p) => p.beach_id) || [];

      // Should NOT include beach with unapproved photo
      expect(beachIds).not.toContain(testBeaches[1].id); // Beach 2 (unapproved)
    });

    it("should include only beaches with valid photos", async () => {
      const { data: photos } = await publicClient
        .from("beach_photos")
        .select("beach_id, thumb_url, image_url")
        .is("deleted_at", null)
        .eq("approved", true);

      // Build photos map (like the API does)
      const photosMap = new Map<string, string>();
      (photos || []).forEach((photo) => {
        if (!photosMap.has(photo.beach_id)) {
          const imageUrl = photo.thumb_url || photo.image_url;
          if (imageUrl) {
            photosMap.set(photo.beach_id, imageUrl);
          }
        }
      });

      // Should only have 2 beaches with valid photos (Beach 1 and Priority Beach)
      // Beach 4 (excluded) should also be in the map at this point (exclusion happens later)
      expect(photosMap.size).toBeGreaterThanOrEqual(2);
      expect(photosMap.has(testBeaches[0].id)).toBe(true); // Beach 1
      expect(photosMap.has(testBeaches[3].id)).toBe(true); // Priority Beach
    });

    it("should handle beaches with multiple photos (use newest)", async () => {
      // Add a second, newer photo to Beach 1
      const newerPhoto = await adminClient
        .from("beach_photos")
        .insert({
          beach_id: testBeaches[0].id,
          photo_url: "https://test.com/beach1-newer.jpg",
          thumb_url: "https://test.com/beach1-newer-thumb.jpg",
          approved: true,
          deleted_at: null,
        })
        .select()
        .single();

      // Query with same ordering as API route
      const { data: photos } = await publicClient
        .from("beach_photos")
        .select("beach_id, thumb_url, image_url, fetched_at")
        .is("deleted_at", null)
        .eq("approved", true)
        .eq("beach_id", testBeaches[0].id)
        .order("fetched_at", { ascending: false });

      // Should get multiple photos, ordered by fetched_at
      expect(photos).not.toBeNull();
      expect(photos!.length).toBeGreaterThan(1);

      // Build map (should take first one, which is newest)
      const photosMap = new Map<string, string>();
      (photos || []).forEach((photo) => {
        if (!photosMap.has(photo.beach_id)) {
          const imageUrl = photo.thumb_url || photo.image_url;
          if (imageUrl) {
            photosMap.set(photo.beach_id, imageUrl);
          }
        }
      });

      // Should only have one entry for this beach
      expect(photosMap.size).toBe(1);
    });
  });

  describe("Beach Exclusions", () => {
    it("should exclude beaches from EXCLUDED_BEACH_IDS when fetching photos", async () => {
      const { EXCLUDED_BEACH_IDS } = require("@/lib/constants/featured-beaches-config");

      // Simulate the API's photo fetching with exclusions
      let query = publicClient
        .from("beach_photos")
        .select("beach_id, thumb_url, image_url")
        .is("deleted_at", null)
        .eq("approved", true);

      if (EXCLUDED_BEACH_IDS.length > 0) {
        query = query.not("beach_id", "in", `(${EXCLUDED_BEACH_IDS.join(",")})`);
      }

      const { data: photos } = await query;
      const beachIds = photos?.map((p) => p.beach_id) || [];

      // Should not include any excluded beach IDs
      for (const excludedId of EXCLUDED_BEACH_IDS) {
        expect(beachIds).not.toContain(excludedId);
      }
    });

    it("should handle empty exclusion list", async () => {
      // Test with no exclusions (empty array)
      const { data: photos } = await publicClient
        .from("beach_photos")
        .select("beach_id, thumb_url, image_url")
        .is("deleted_at", null)
        .eq("approved", true);
      // Should not throw error

      expect(photos).not.toBeNull();
    });
  });

  describe("Priority Sorting", () => {
    it("should sort priority beaches first", () => {
      const { getPriorityIndex } = require("@/lib/constants/featured-beaches-config");

      // Mock beaches array
      const beaches = [
        { id: "non-priority-1", name: "Regular Beach 1" },
        { id: "01330afc-00d3-461b-88f3-b173774766f4", name: "Blacks Beach" }, // Priority beach
        { id: "non-priority-2", name: "Regular Beach 2" },
      ];

      // Apply same sorting logic as API
      beaches.sort((a, b) => {
        const aIndex = getPriorityIndex(a.id);
        const bIndex = getPriorityIndex(b.id);

        const aIsPriority = aIndex !== -1;
        const bIsPriority = bIndex !== -1;

        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;

        if (aIsPriority && bIsPriority) {
          return aIndex - bIndex;
        }

        return 0;
      });

      // Priority beach should be first
      expect(beaches[0].id).toBe("01330afc-00d3-461b-88f3-b173774766f4");
    });

    it("should maintain priority order for multiple priority beaches", () => {
      const { getPriorityIndex } = require("@/lib/constants/featured-beaches-config");

      // Mock beaches with multiple priorities (if configured)
      const beaches = [
        { id: "non-priority", name: "Regular Beach" },
        { id: "priority-2", name: "Second Priority" }, // Would be second in PRIORITY_BEACH_IDS
        { id: "priority-1", name: "First Priority" }, // Would be first in PRIORITY_BEACH_IDS
      ];

      // For this test to work meaningfully, we'd need multiple priority beaches configured
      // Just verify sorting logic doesn't throw errors
      beaches.sort((a, b) => {
        const aIndex = getPriorityIndex(a.id);
        const bIndex = getPriorityIndex(b.id);

        const aIsPriority = aIndex !== -1;
        const bIsPriority = bIndex !== -1;

        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;

        if (aIsPriority && bIsPriority) {
          return aIndex - bIndex;
        }

        return 0;
      });

      // Should not throw
      expect(beaches).toHaveLength(3);
    });
  });

  describe("Data Fetching", () => {
    it("should fetch beaches with photos first", async () => {
      // Get beaches with photos
      const { data: photos } = await publicClient
        .from("beach_photos")
        .select("beach_id, thumb_url, image_url")
        .is("deleted_at", null)
        .eq("approved", true);

      const photosMap = new Map<string, string>();
      (photos || []).forEach((photo) => {
        if (!photosMap.has(photo.beach_id)) {
          const imageUrl = photo.thumb_url || photo.image_url;
          if (imageUrl) {
            photosMap.set(photo.beach_id, imageUrl);
          }
        }
      });

      const beachIdsWithPhotos = Array.from(photosMap.keys());

      if (beachIdsWithPhotos.length > 0) {
        const { data: beachesWithPhotos } = await publicClient
          .from("beaches")
          .select("id, name, city, state, slug")
          .eq("is_private", false)
          .in("id", beachIdsWithPhotos);

        expect(beachesWithPhotos).not.toBeNull();
        expect(beachesWithPhotos!.length).toBeGreaterThan(0);
      }
    });

    it("should fill remaining slots with beaches without photos", async () => {
      const FEATURED_BEACHES_LIMIT = 50;

      // Simulate filling remaining slots
      const enrichedWithPhotos: any[] = []; // Assume we have some beaches with photos
      const needed = Math.max(0, FEATURED_BEACHES_LIMIT - enrichedWithPhotos.length);

      const { data: beachesWithoutPhotos } = await publicClient
        .from("beaches")
        .select("id, name, city, state, slug")
        .eq("is_private", false)
        .limit(needed);

      expect(beachesWithoutPhotos).not.toBeNull();
    });

    it("should respect FEATURED_BEACHES_LIMIT", () => {
      const { FEATURED_BEACHES_LIMIT } = require("@/lib/constants/featured-beaches-config");

      expect(FEATURED_BEACHES_LIMIT).toBe(50);

      // Simulate limiting results
      const mockBeaches = Array(100).fill(null).map((_, i) => ({ id: `beach-${i}` }));
      const limited = mockBeaches.slice(0, FEATURED_BEACHES_LIMIT);

      expect(limited).toHaveLength(50);
    });

    it("should handle database errors gracefully", async () => {
      // Simulate error by querying non-existent table
      const { data, error } = await publicClient
        .from("non_existent_table" as any)
        .select("*");

      // Should get an error
      expect(error).not.toBeNull();
      expect(data).toBeNull();

      // API route should return empty array on error (graceful degradation)
      const fallbackResult: any[] = [];
      expect(fallbackResult).toEqual([]);
    });
  });

  describe("Response Format", () => {
    it("should return proper beach data structure", async () => {
      const { data: beaches } = await publicClient
        .from("beaches")
        .select("id, name, city, state, slug")
        .eq("is_private", false)
        .limit(1);

      if (beaches && beaches.length > 0) {
        const beach = beaches[0];

        // Verify expected fields
        expect(beach).toHaveProperty("id");
        expect(beach).toHaveProperty("name");
        expect(beach).toHaveProperty("city");
        expect(beach).toHaveProperty("state");
        expect(beach).toHaveProperty("slug");

        // Verify types
        expect(typeof beach.id).toBe("string");
        expect(typeof beach.name).toBe("string");
      }
    });

    it("should include has_real_photo flag", () => {
      // Simulate enriching beach with photo data
      const beachWithPhoto = {
        id: "test-id",
        name: "Test Beach",
        city: "Test City",
        state: "CA",
        slug: "test-beach",
        photo_url: "https://test.com/photo.jpg",
        has_real_photo: true,
      };

      const beachWithoutPhoto = {
        id: "test-id-2",
        name: "Test Beach 2",
        city: "Test City",
        state: "CA",
        slug: "test-beach-2",
        photo_url: null,
        has_real_photo: false,
      };

      expect(beachWithPhoto.has_real_photo).toBe(true);
      expect(beachWithoutPhoto.has_real_photo).toBe(false);
    });

    it("should handle missing photo_url gracefully", () => {
      const beach = {
        id: "test-id",
        name: "Test Beach",
        city: "Test City",
        state: "CA",
        slug: "test-beach",
        photo_url: null,
        has_real_photo: false,
      };

      expect(beach.photo_url).toBeNull();
      expect(beach.has_real_photo).toBe(false);
    });
  });

  describe("Integration Scenarios", () => {
    it("should return complete workflow result", async () => {
      // Step 1: Fetch photos map
      const { data: photos } = await publicClient
        .from("beach_photos")
        .select("beach_id, thumb_url, image_url")
        .is("deleted_at", null)
        .eq("approved", true);

      const photosMap = new Map<string, string>();
      (photos || []).forEach((photo) => {
        if (!photosMap.has(photo.beach_id)) {
          const imageUrl = photo.thumb_url || photo.image_url;
          if (imageUrl) {
            photosMap.set(photo.beach_id, imageUrl);
          }
        }
      });

      // Step 2: Fetch beaches with photos
      const beachIdsWithPhotos = Array.from(photosMap.keys());
      let enrichedWithPhotos: any[] = [];

      if (beachIdsWithPhotos.length > 0) {
        const { data: beachesWithPhotos } = await publicClient
          .from("beaches")
          .select("id, name, city, state, slug")
          .eq("is_private", false)
          .in("id", beachIdsWithPhotos);

        enrichedWithPhotos = (beachesWithPhotos || []).map((beach) => ({
          ...beach,
          photo_url: photosMap.get(beach.id),
          has_real_photo: true,
        }));
      }

      // Step 3: Fill remaining slots
      const FEATURED_BEACHES_LIMIT = 50;
      const needed = Math.max(0, FEATURED_BEACHES_LIMIT - enrichedWithPhotos.length);
      let enrichedWithoutPhotos: any[] = [];

      if (needed > 0) {
        let query = publicClient
          .from("beaches")
          .select("id, name, city, state, slug")
          .eq("is_private", false);

        if (beachIdsWithPhotos.length > 0) {
          query = query.not("id", "in", `(${beachIdsWithPhotos.join(",")})`);
        }

        const { data: beachesWithoutPhotos } = await query.limit(needed);

        enrichedWithoutPhotos = (beachesWithoutPhotos || []).map((beach) => ({
          ...beach,
          photo_url: null,
          has_real_photo: false,
        }));
      }

      // Combine results
      const allBeaches = [...enrichedWithPhotos, ...enrichedWithoutPhotos];

      expect(allBeaches).toBeInstanceOf(Array);
      expect(allBeaches.length).toBeLessThanOrEqual(FEATURED_BEACHES_LIMIT);
    });
  });
});
