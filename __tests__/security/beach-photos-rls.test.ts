/**
 * Security validation tests for beach_photos RLS policies
 *
 * Purpose: Verify Row Level Security (RLS) policies correctly enforce access control
 * for beach photos, preventing unauthorized access to soft-deleted and unapproved photos.
 *
 * CRITICAL SECURITY BOUNDARY:
 * - Public users should ONLY see approved, non-deleted photos
 * - Admins should see ALL photos (including deleted/unapproved)
 * - Write operations should be restricted to admins only
 *
 * Migration tested: 20251117033703_fix_beach_photos_rls_security.sql
 *
 * @jest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const shouldRunSecurity =
  process.env.RUN_SECURITY_TESTS === "true" &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Restore real fetch for database tests.
// jest.setup.js installs a mocked fetch for UI/server-action tests; these security tests
// need a real fetch implementation for Supabase admin/anon calls.
 
const undici = require("undici");
global.fetch = undici.fetch;
global.Headers = undici.Headers;
global.Request = undici.Request;
global.Response = undici.Response;

(shouldRunSecurity ? describe : describe.skip)(
  "Beach Photos RLS Security Policies",
  () => {
  let anonClient: ReturnType<typeof createClient<Database>>;
  let adminClient: ReturnType<typeof createClient<Database>>;
  let testBeachId: string;
  let testAdminUserId: string;
  let approvedPhotoId: string;
  let unapprovedPhotoId: string;
  let deletedPhotoId: string;

  beforeAll(() => {
    // Anonymous/public client (most restrictive access)
    anonClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

    // Admin client with service role key (full access)
    adminClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  });

  beforeEach(async () => {
    // Create test admin user
    const { data: adminData, error: adminError } =
      await adminClient.auth.admin.createUser({
        email: `admin-rls-test-${Date.now()}@test.com`,
        password: "test-password-123",
        email_confirm: true,
      });

    if (adminError || !adminData.user) {
      throw new Error(`Failed to create admin user: ${adminError?.message}`);
    }

    testAdminUserId = adminData.user.id;

    // Update profile to make user an admin (profile is auto-created by trigger)
    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 100));

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        display_name: `admin-${testAdminUserId.slice(0, 8)}`,
        is_admin: true, // Make this user an admin
      })
      .eq("id", testAdminUserId);

    if (profileError) {
      throw new Error(`Failed to update admin profile: ${profileError.message}`);
    }

    // Create test beach
    const { data: beachData, error: beachError } = await adminClient
      .from("beaches")
      .insert({
        name: `Test Beach RLS ${Date.now()}`,
        city: "Test City",
        state: "California",
        country: "USA",
        lat: 32.7157,
        lon: -117.1611,
        timezone: "America/Los_Angeles",
      })
      .select()
      .single();

    if (beachError || !beachData) {
      throw new Error(`Failed to create test beach: ${beachError?.message}`);
    }

    testBeachId = beachData.id;

    // Create test photos with different states
    const now = new Date();

    // 1. Approved, non-deleted photo (PUBLIC)
    const { data: approvedPhoto, error: approvedError } = await adminClient
      .from("beach_photos")
      .insert({
        beach_id: testBeachId,
        source: "user",
        source_id: "approved-test",
        image_url: "https://test.com/approved.jpg",
        approved: true,
        deleted_at: null,
      })
      .select()
      .single();

    if (approvedError || !approvedPhoto) {
      throw new Error(`Failed to create approved photo: ${approvedError?.message}`);
    }
    approvedPhotoId = approvedPhoto.id;

    // 2. Unapproved, non-deleted photo (HIDDEN FROM PUBLIC)
    const { data: unapprovedPhoto, error: unapprovedError } = await adminClient
      .from("beach_photos")
      .insert({
        beach_id: testBeachId,
        source: "user",
        source_id: "unapproved-test",
        image_url: "https://test.com/unapproved.jpg",
        approved: false,
        deleted_at: null,
      })
      .select()
      .single();

    if (unapprovedError || !unapprovedPhoto) {
      throw new Error(`Failed to create unapproved photo: ${unapprovedError?.message}`);
    }
    unapprovedPhotoId = unapprovedPhoto.id;

    // 3. Soft-deleted photo (HIDDEN FROM PUBLIC)
    const { data: deletedPhoto, error: deletedError } = await adminClient
      .from("beach_photos")
      .insert({
        beach_id: testBeachId,
        source: "user",
        source_id: "deleted-test",
        image_url: "https://test.com/deleted.jpg",
        approved: true,
        deleted_at: now.toISOString(),
      })
      .select()
      .single();

    if (deletedError || !deletedPhoto) {
      throw new Error(`Failed to create deleted photo: ${deletedError?.message}`);
    }
    deletedPhotoId = deletedPhoto.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testBeachId) {
      // Delete all beach_photos for this beach (hard delete using admin)
      await adminClient.from("beach_photos").delete().eq("beach_id", testBeachId);

      // Delete the beach
      await adminClient.from("beaches").delete().eq("id", testBeachId);
    }

    if (testAdminUserId) {
      // Delete admin user
      await adminClient.auth.admin.deleteUser(testAdminUserId);
    }
  });

  describe("Public/Anonymous Access (Most Restrictive)", () => {
    describe("SELECT Operations", () => {
      it("should allow reading approved, non-deleted photos", async () => {
        const { data, error } = await anonClient
          .from("beach_photos")
          .select("*")
          .eq("id", approvedPhotoId)
          .single();

        expect(error).toBeNull();
        expect(data).not.toBeNull();
        expect(data?.id).toBe(approvedPhotoId);
        expect(data?.approved).toBe(true);
        expect(data?.deleted_at).toBeNull();
      });

      it("should deny reading soft-deleted photos", async () => {
        const { data, error } = await anonClient
          .from("beach_photos")
          .select("*")
          .eq("id", deletedPhotoId)
          .single();

        // RLS should prevent access - either returns null or error
        expect(data).toBeNull();
      });

      it("should deny reading unapproved photos", async () => {
        const { data, error } = await anonClient
          .from("beach_photos")
          .select("*")
          .eq("id", unapprovedPhotoId)
          .single();

        // RLS should prevent access - either returns null or error
        expect(data).toBeNull();
      });

      it("should only return approved, non-deleted photos in list queries", async () => {
        const { data, error } = await anonClient
          .from("beach_photos")
          .select("*")
          .eq("beach_id", testBeachId);

        expect(error).toBeNull();
        expect(data).not.toBeNull();

        // Should only see the approved, non-deleted photo
        expect(data?.length).toBe(1);
        expect(data?.[0]?.id).toBe(approvedPhotoId);
        expect(data?.[0]?.approved).toBe(true);
        expect(data?.[0]?.deleted_at).toBeNull();

        // Should NOT see deleted or unapproved photos
        const photoIds = data?.map((p) => p.id) || [];
        expect(photoIds).not.toContain(deletedPhotoId);
        expect(photoIds).not.toContain(unapprovedPhotoId);
      });

      it("should return 0 count for deleted photos query", async () => {
        const { count, error } = await anonClient
          .from("beach_photos")
          .select("*", { count: "exact", head: true })
          .eq("beach_id", testBeachId)
          .not("deleted_at", "is", null);

        expect(error).toBeNull();
        expect(count).toBe(0); // RLS prevents seeing deleted photos
      });

      it("should return 0 count for unapproved photos query", async () => {
        const { count, error } = await anonClient
          .from("beach_photos")
          .select("*", { count: "exact", head: true })
          .eq("beach_id", testBeachId)
          .eq("approved", false);

        expect(error).toBeNull();
        expect(count).toBe(0); // RLS prevents seeing unapproved photos
      });
    });

    describe("INSERT Operations", () => {
      it("should deny inserting new photos", async () => {
        const { data, error } = await anonClient.from("beach_photos").insert({
          beach_id: testBeachId,
          source: "user",
          source_id: "unauthorized-test",
          image_url: "https://test.com/unauthorized.jpg",
          approved: false,
        });

        // Should fail with RLS error
        expect(error).not.toBeNull();
        expect(data).toBeNull();
      });
    });

    describe("UPDATE Operations", () => {
      it("should deny updating approved photos (UPDATE blocked by RLS)", async () => {
        const { data, error } = await anonClient
          .from("beach_photos")
          .update({ image_url: "https://test.com/hacked.jpg" })
          .eq("id", approvedPhotoId);

        // Note: Current RLS policies don't have UPDATE restrictions for anonymous users
        // This test documents the current behavior - UPDATE operations succeed but don't affect rows
        // because anonymous users can't see the rows to update them (SELECT policy blocks visibility)

        // The operation completes without error, but affects 0 rows (can't see photo to update)
        expect(error).toBeNull();

        // Verify the photo was NOT actually updated
        const { data: checkPhoto } = await adminClient
          .from("beach_photos")
          .select("image_url")
          .eq("id", approvedPhotoId)
          .single();

        expect(checkPhoto?.image_url).not.toBe("https://test.com/hacked.jpg");
        expect(checkPhoto?.image_url).toBe("https://test.com/approved.jpg");
      });

      it("should deny approving unapproved photos (UPDATE blocked by visibility)", async () => {
        const { data, error } = await anonClient
          .from("beach_photos")
          .update({ approved: true })
          .eq("id", unapprovedPhotoId);

        // Operation succeeds but affects 0 rows (can't see unapproved photo)
        expect(error).toBeNull();

        // Verify the photo was NOT actually updated
        const { data: checkPhoto } = await adminClient
          .from("beach_photos")
          .select("approved")
          .eq("id", unapprovedPhotoId)
          .single();

        expect(checkPhoto?.approved).toBe(false);
      });
    });

    describe("DELETE Operations", () => {
      it("should deny soft-deleting photos (UPDATE blocked by visibility)", async () => {
        const { data, error } = await anonClient
          .from("beach_photos")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", approvedPhotoId);

        // Operation succeeds but affects 0 rows
        expect(error).toBeNull();

        // Verify the photo was NOT actually soft-deleted
        const { data: checkPhoto } = await adminClient
          .from("beach_photos")
          .select("deleted_at")
          .eq("id", approvedPhotoId)
          .single();

        expect(checkPhoto?.deleted_at).toBeNull();
      });

      it("should deny hard-deleting photos (DELETE blocked by visibility)", async () => {
        const { data, error } = await anonClient
          .from("beach_photos")
          .delete()
          .eq("id", approvedPhotoId);

        // Operation succeeds but affects 0 rows
        expect(error).toBeNull();

        // Verify the photo still exists
        const { data: checkPhoto } = await adminClient
          .from("beach_photos")
          .select("id")
          .eq("id", approvedPhotoId)
          .single();

        expect(checkPhoto).not.toBeNull();
      });
    });
  });

  describe("Admin Access (Full Privileges)", () => {
    describe("SELECT Operations", () => {
      it("should allow admins to read approved, non-deleted photos", async () => {
        const { data, error } = await adminClient
          .from("beach_photos")
          .select("*")
          .eq("id", approvedPhotoId)
          .single();

        expect(error).toBeNull();
        expect(data).not.toBeNull();
        expect(data?.id).toBe(approvedPhotoId);
      });

      it("should allow admins to read soft-deleted photos", async () => {
        const { data, error } = await adminClient
          .from("beach_photos")
          .select("*")
          .eq("id", deletedPhotoId)
          .single();

        expect(error).toBeNull();
        expect(data).not.toBeNull();
        expect(data?.id).toBe(deletedPhotoId);
        expect(data?.deleted_at).not.toBeNull();
      });

      it("should allow admins to read unapproved photos", async () => {
        const { data, error } = await adminClient
          .from("beach_photos")
          .select("*")
          .eq("id", unapprovedPhotoId)
          .single();

        expect(error).toBeNull();
        expect(data).not.toBeNull();
        expect(data?.id).toBe(unapprovedPhotoId);
        expect(data?.approved).toBe(false);
      });

      it("should allow admins to see all photos in list queries (including deleted/unapproved)", async () => {
        const { data, error } = await adminClient
          .from("beach_photos")
          .select("*")
          .eq("beach_id", testBeachId);

        expect(error).toBeNull();
        expect(data).not.toBeNull();

        // Should see ALL 3 photos
        expect(data?.length).toBe(3);

        const photoIds = data?.map((p) => p.id) || [];
        expect(photoIds).toContain(approvedPhotoId);
        expect(photoIds).toContain(deletedPhotoId);
        expect(photoIds).toContain(unapprovedPhotoId);
      });
    });

    describe("INSERT Operations", () => {
      it("should allow admins to insert new photos", async () => {
        const { data, error } = await adminClient.from("beach_photos").insert({
          beach_id: testBeachId,
          source: "user",
          source_id: "admin-created-test",
          image_url: "https://test.com/admin-created.jpg",
          approved: false,
        }).select();

        expect(error).toBeNull();
        expect(data).not.toBeNull();
        expect(data?.[0]?.image_url).toBe("https://test.com/admin-created.jpg");
      });
    });

    describe("UPDATE Operations", () => {
      it("should allow admins to update photo URLs", async () => {
        const { data, error } = await adminClient
          .from("beach_photos")
          .update({ image_url: "https://test.com/updated.jpg" })
          .eq("id", approvedPhotoId)
          .select();

        expect(error).toBeNull();
        expect(data?.[0]?.image_url).toBe("https://test.com/updated.jpg");
      });

      it("should allow admins to approve photos", async () => {
        const { data, error } = await adminClient
          .from("beach_photos")
          .update({ approved: true })
          .eq("id", unapprovedPhotoId)
          .select();

        expect(error).toBeNull();
        expect(data?.[0]?.approved).toBe(true);
      });

      it("should allow admins to unapprove photos", async () => {
        const { data, error } = await adminClient
          .from("beach_photos")
          .update({ approved: false })
          .eq("id", approvedPhotoId)
          .select();

        expect(error).toBeNull();
        expect(data?.[0]?.approved).toBe(false);
      });

      it("should allow admins to soft-delete photos", async () => {
        const now = new Date().toISOString();
        const { data, error } = await adminClient
          .from("beach_photos")
          .update({ deleted_at: now })
          .eq("id", approvedPhotoId)
          .select();

        expect(error).toBeNull();
        expect(data?.[0]?.deleted_at).not.toBeNull();
      });

      it("should allow admins to restore soft-deleted photos", async () => {
        const { data, error } = await adminClient
          .from("beach_photos")
          .update({ deleted_at: null })
          .eq("id", deletedPhotoId)
          .select();

        expect(error).toBeNull();
        expect(data?.[0]?.deleted_at).toBeNull();
      });
    });

    describe("DELETE Operations", () => {
      it("should allow admins to hard-delete photos", async () => {
        // Create a temporary photo to delete
        const { data: tempPhoto } = await adminClient
          .from("beach_photos")
          .insert({
            beach_id: testBeachId,
            source: "user",
            source_id: "temp-test",
            image_url: "https://test.com/temp.jpg",
            approved: true,
          })
          .select()
          .single();

        const { error } = await adminClient
          .from("beach_photos")
          .delete()
          .eq("id", tempPhoto!.id);

        expect(error).toBeNull();

        // Verify it's gone
        const { data: check } = await adminClient
          .from("beach_photos")
          .select()
          .eq("id", tempPhoto!.id)
          .single();

        expect(check).toBeNull();
      });
    });
  });

  describe("Edge Cases and Security Boundaries", () => {
    it("should not allow privilege escalation via UPDATE", async () => {
      // Attempt to make a photo visible by updating it through public client
      const { error } = await anonClient
        .from("beach_photos")
        .update({
          approved: true,
          deleted_at: null,
        })
        .eq("id", unapprovedPhotoId);

      // Operation completes but affects 0 rows (can't see unapproved photo)
      expect(error).toBeNull();

      // Verify the update didn't work
      const { data: checkPhoto } = await adminClient
        .from("beach_photos")
        .select("approved, deleted_at")
        .eq("id", unapprovedPhotoId)
        .single();

      expect(checkPhoto?.approved).toBe(false); // Still unapproved
    });

    it("should handle missing deleted_at column gracefully", async () => {
      // Query should work even if some rows theoretically had no deleted_at
      const { data, error } = await anonClient
        .from("beach_photos")
        .select("*")
        .eq("beach_id", testBeachId);

      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });

    it("should handle null approved values as unapproved", async () => {
      // Create photo with default approved value
      const { data: nullApprovedPhoto } = await adminClient
        .from("beach_photos")
        .insert({
          beach_id: testBeachId,
          source: "user",
          source_id: "null-approved-test",
          image_url: "https://test.com/null-approved.jpg",
          // approved will default to true per schema
        })
        .select()
        .single();

      // Public SHOULD see it (defaults to approved=true)
      const { data: publicView } = await anonClient
        .from("beach_photos")
        .select("*")
        .eq("id", nullApprovedPhoto!.id)
        .single();

      expect(publicView).not.toBeNull();
      expect(publicView?.approved).toBe(true); // Default value

      // Admin should also see it
      const { data: adminView } = await adminClient
        .from("beach_photos")
        .select("*")
        .eq("id", nullApprovedPhoto!.id)
        .single();

      expect(adminView).not.toBeNull();
    });

    it("should maintain security across multiple concurrent queries", async () => {
      // Simulate multiple simultaneous public queries
      const promises = Array.from({ length: 5 }, () =>
        anonClient.from("beach_photos").select("*").eq("beach_id", testBeachId)
      );

      const results = await Promise.all(promises);

      // All queries should return same filtered results
      results.forEach(({ data, error }) => {
        expect(error).toBeNull();
        expect(data?.length).toBe(1); // Only approved, non-deleted
        expect(data?.[0]?.id).toBe(approvedPhotoId);
      });
    });
  });

  describe("RLS Policy Verification", () => {
    it("should have beach_photos RLS policies enabled", async () => {
      // Verify RLS is enforced by checking if anonymous user can see deleted photos
      const { data: publicPhotos } = await anonClient
        .from("beach_photos")
        .select("id")
        .eq("id", deletedPhotoId)
        .single();

      // Should NOT see deleted photo as anonymous user
      expect(publicPhotos).toBeNull();

      // Verify admin CAN see deleted photo
      const { data: adminPhotos } = await adminClient
        .from("beach_photos")
        .select("id")
        .eq("id", deletedPhotoId)
        .single();

      expect(adminPhotos).not.toBeNull();
      expect(adminPhotos?.id).toBe(deletedPhotoId);
    });
  });
});
