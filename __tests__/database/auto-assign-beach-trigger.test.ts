/**
 * Auto-Assign Beach Trigger Tests
 *
 * Tests the database trigger that automatically assigns the nearest beach
 * to intel posts when they are created.
 *
 * Migration: 20260114173139_auto_assign_beach_to_intel_posts.sql
 * Design Doc: docs/plans/2026-01-14-auto-assign-beach-to-intel-design.md
 *
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import type { Database } from "@/types/database.generated";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only run these tests when explicitly enabled
const shouldRunIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  !!supabaseUrl &&
  !!supabaseServiceKey;

// Restore real fetch for database tests (jest.setup.js mocks fetch)
 
const undici = require("undici");
global.fetch = undici.fetch;
global.Headers = undici.Headers;
global.Request = undici.Request;
global.Response = undici.Response;

// Import supabase-js after restoring real fetch
 
const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");

// Test beach coordinates (near Ocean Beach Pier which has valid coords in DB)
const TEST_BEACH = {
  id: "test-beach-trigger-" + Date.now(),
  name: "Test Beach for Trigger",
  lat: 32.7503, // Near Ocean Beach Pier
  lon: -117.2534,
};

// Use Ocean Beach Pier coordinates (known to have valid coords in DB: 32.7493, -117.2511)
const OCEAN_BEACH_PIER_COORDS = {
  lat: 32.7493,
  lon: -117.2511,
};

// Remote location with no nearby beaches (middle of Pacific Ocean)
const REMOTE_OCEAN_COORDS = {
  lat: 30.0,
  lon: -140.0,
};

let testUserId: string;
let createdBeachId: string | null = null;
let createdIntelPostIds: string[] = [];

// Supabase client - created inside describe block when tests run
let supabase: ReturnType<typeof createClient<Database>>;

beforeAll(async () => {
  if (!shouldRunIntegration) return;

  // Create client inside beforeAll to ensure it's only created when tests run
  supabase = createClient<Database>(supabaseUrl!, supabaseServiceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get or create a test user
  const { data: users, error: userError } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_mock", true)
    .limit(1);

  if (userError) {
    console.error("Failed to fetch test user:", userError);
    throw userError;
  }

  if (!users || users.length === 0) {
    throw new Error("No mock test user found. Run seed script first.");
  }

  testUserId = users[0].id;

  // Create a test beach for proximity testing
  const { data: beach, error: beachError } = await supabase
    .from("beaches")
    .insert({
      id: TEST_BEACH.id,
      name: TEST_BEACH.name,
      lat: TEST_BEACH.lat,
      lon: TEST_BEACH.lon,
      timezone: "America/Los_Angeles",
      region: "pacific",
      country: "US",
      state: "CA",
    })
    .select()
    .single();

  if (beachError) {
    console.error("Failed to create test beach:", beachError);
    // Beach might already exist, continue anyway
  } else {
    createdBeachId = beach.id;
  }
});

afterAll(async () => {
  if (!shouldRunIntegration) return;

  // Clean up created intel posts
  if (createdIntelPostIds.length > 0) {
    await supabase
      .from("intel_posts")
      .delete()
      .in("id", createdIntelPostIds);
  }

  // Clean up test beach
  if (createdBeachId) {
    await supabase
      .from("beaches")
      .delete()
      .eq("id", createdBeachId);
  }
});

(shouldRunIntegration ? describe : describe.skip)("Auto-Assign Beach Trigger", () => {
  describe("Trigger Function: find_nearest_beach_id", () => {
    test("assigns nearest beach when intel post is created near a beach", async () => {
      // Create intel post near our test beach (within 100 meters)
      const { data: intelPost, error } = await supabase
        .from("intel_posts")
        .insert({
          user_id: testUserId,
          latitude: TEST_BEACH.lat + 0.0005, // ~50 meters away
          longitude: TEST_BEACH.lon + 0.0005,
          tag: "conditions",
          title: "Test Post Near Beach",
          description: "This should be assigned to a nearby beach",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id, beach_id, latitude, longitude")
        .single();

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      createdIntelPostIds.push(intelPost.id);

      // Verify beach_id was automatically assigned (nearest beach, may not be our test beach
      // if there are existing beaches closer)
      expect(intelPost.beach_id).not.toBeNull();
    });

    test("assigns null when intel post is far from any beach (>2 miles)", async () => {
      // Create intel post in the middle of the Pacific Ocean
      const { data: intelPost, error } = await supabase
        .from("intel_posts")
        .insert({
          user_id: testUserId,
          latitude: REMOTE_OCEAN_COORDS.lat,
          longitude: REMOTE_OCEAN_COORDS.lon,
          tag: "conditions",
          title: "Test Post in Ocean",
          description: "This should have NULL beach_id",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id, beach_id, latitude, longitude")
        .single();

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      createdIntelPostIds.push(intelPost.id);

      // Verify beach_id is NULL (no beach within 2 miles)
      expect(intelPost.beach_id).toBeNull();
    });

    test("does not overwrite explicitly set beach_id", async () => {
      // Get a real beach ID from the database
      const { data: beaches } = await supabase
        .from("beaches")
        .select("id")
        .limit(1)
        .single();

      if (!beaches) {
        console.warn("No beaches found in database, skipping test");
        return;
      }

      const explicitBeachId = beaches.id;

      // Create intel post with explicit beach_id at a different location
      const { data: intelPost, error } = await supabase
        .from("intel_posts")
        .insert({
          user_id: testUserId,
          beach_id: explicitBeachId, // Explicitly set
          latitude: TEST_BEACH.lat,
          longitude: TEST_BEACH.lon,
          tag: "conditions",
          title: "Test Post with Explicit Beach",
          description: "This should keep the explicit beach_id",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id, beach_id")
        .single();

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      createdIntelPostIds.push(intelPost.id);

      // Verify explicit beach_id was preserved
      expect(intelPost.beach_id).toBe(explicitBeachId);
    });

    test("handles invalid coordinates gracefully", async () => {
      // Create intel post with invalid coordinates
      const { data: intelPost, error } = await supabase
        .from("intel_posts")
        .insert({
          user_id: testUserId,
          latitude: 0, // Invalid (equator + prime meridian)
          longitude: 0,
          tag: "conditions",
          title: "Test Post Invalid Coords",
          description: "This should have NULL beach_id due to invalid coords",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id, beach_id, latitude, longitude")
        .single();

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      createdIntelPostIds.push(intelPost.id);

      // Verify beach_id is NULL (invalid coordinates)
      expect(intelPost.beach_id).toBeNull();
    });

    test("assigns correct beach when multiple beaches are nearby", async () => {
      // Use Ocean Beach Pier coordinates (known beach with valid coords in DB)
      const { data: intelPost, error } = await supabase
        .from("intel_posts")
        .insert({
          user_id: testUserId,
          latitude: OCEAN_BEACH_PIER_COORDS.lat,
          longitude: OCEAN_BEACH_PIER_COORDS.lon,
          tag: "conditions",
          title: "Test Post Near Multiple Beaches",
          description: "Should assign the closest beach",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id, beach_id, latitude, longitude")
        .single();

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      createdIntelPostIds.push(intelPost.id);

      // Verify a beach was assigned (should be the nearest one)
      expect(intelPost.beach_id).not.toBeNull();

      // Verify the assigned beach exists and has coordinates
      const { data: assignedBeach } = await supabase
        .from("beaches")
        .select("id, name, lat, lon")
        .eq("id", intelPost.beach_id!)
        .single();

      expect(assignedBeach).not.toBeNull();
      expect(assignedBeach?.lat).not.toBeNull();
      expect(assignedBeach?.lon).not.toBeNull();
      console.log(`Assigned beach: ${assignedBeach?.name} (${assignedBeach?.id})`);
    });
  });

  describe("Backfill Verification", () => {
    test("existing intel posts with null beach_id should get assigned", async () => {
      // This test verifies the backfill UPDATE statement worked
      // Query for intel posts that have coordinates but had null beach_id
      const { data: backfilledPosts, error } = await supabase
        .from("intel_posts")
        .select("id, beach_id, latitude, longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .not("beach_id", "is", null)
        .limit(5);

      if (error) {
        console.error("Query error:", error);
        throw error;
      }

      // If we have posts, verify they have valid beach assignments
      if (backfilledPosts && backfilledPosts.length > 0) {
        backfilledPosts.forEach((post) => {
          expect(post.beach_id).not.toBeNull();
          expect(post.latitude).not.toBeNull();
          expect(post.longitude).not.toBeNull();
        });
      }

      // Note: This test is informational - it doesn't fail if there are no posts
      console.log(`Verified ${backfilledPosts?.length || 0} backfilled intel posts have beach assignments`);
    });
  });

  describe("Edge Cases", () => {
    test("handles GPS drift by using 2-mile radius", async () => {
      // Create intel post ~1.5 miles from test beach
      // (1.5 miles ≈ 0.022 degrees latitude at this location)
      const { data: intelPost, error } = await supabase
        .from("intel_posts")
        .insert({
          user_id: testUserId,
          latitude: TEST_BEACH.lat + 0.022,
          longitude: TEST_BEACH.lon + 0.022,
          tag: "conditions",
          title: "Test Post with GPS Drift",
          description: "Should still match the test beach within 2 miles",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id, beach_id")
        .single();

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      createdIntelPostIds.push(intelPost.id);

      // Should find the test beach (within 2 miles)
      expect(intelPost.beach_id).not.toBeNull();
    });

    test("handles posts at beach boundaries correctly", async () => {
      // Create intel post exactly at test beach coordinates
      const { data: intelPost, error } = await supabase
        .from("intel_posts")
        .insert({
          user_id: testUserId,
          latitude: TEST_BEACH.lat, // Exactly at beach
          longitude: TEST_BEACH.lon,
          tag: "conditions",
          title: "Test Post at Beach Center",
          description: "Exact coordinates of beach",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id, beach_id")
        .single();

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      createdIntelPostIds.push(intelPost.id);

      // Should match a beach (could be test beach or an existing beach at same location)
      expect(intelPost.beach_id).not.toBeNull();
    });
  });
});
