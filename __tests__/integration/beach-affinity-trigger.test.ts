/**
 * Integration tests for beach affinity trigger behavior
 *
 * Purpose: Verify that the update_beach_affinity_trigger automatically maintains
 * the user_beach_affinity table when sessions are added, modified, or deleted
 *
 * Tests trigger behavior on:
 * - INSERT: Creates new affinity records
 * - UPDATE: Recalculates affinity when session data changes
 * - DELETE: Updates or removes affinity records when sessions are deleted
 *
 * @jest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Restore real fetch for database tests (undo the global mock from jest.setup.js)
// @ts-ignore
delete global.fetch;

describe("Beach Affinity Trigger Integration", () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let testUserId: string;
  let testBeachId: string;

  beforeAll(() => {
    if (!supabaseServiceKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY not set. Required for trigger integration tests."
      );
    }
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
  });

  beforeEach(async () => {
    // Create test user
    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email: `test-trigger-${Date.now()}@test.com`,
        password: "test-password-123",
        email_confirm: true,
      });

    if (userError || !userData.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }

    testUserId = userData.user.id;

    // Create profile for the user (required for sessions)
    await supabase.from("profiles").insert({
      id: testUserId,
      email: userData.user.email!,
      full_name: "Test User",
    });

    // Create test beach
    const { data: beachData, error: beachError } = await supabase
      .from("beaches")
      .insert({
        name: `Trigger Test Beach ${Date.now()}`,
        city: "Test City",
        state: "California",
        country: "USA",
        lat: 32.7157,
        lon: -117.1611,
      })
      .select()
      .single();

    if (beachError || !beachData) {
      throw new Error(`Failed to create test beach: ${beachError?.message}`);
    }

    testBeachId = beachData.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      await supabase.from("sessions").delete().eq("user_id", testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
    }

    if (testBeachId) {
      await supabase.from("beaches").delete().eq("id", testBeachId);
    }
  });

  describe("INSERT Trigger Behavior", () => {
    it("should create affinity record when first session is added", async () => {
      // Verify no affinity record exists initially
      const { data: initialAffinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(initialAffinity).toBeNull();

      // Insert a session (trigger should fire)
      const arrivalTime = new Date();
      const { error: sessionError } = await supabase.from("sessions").insert({
        user_id: testUserId,
        profile_id: testUserId, // profile_id is required
        beach_id: testBeachId,
        arrival_time: arrivalTime.toISOString(),
        duration_minutes: 120, // Use duration_minutes instead of departure_time
        notes: "First session",
      });

      expect(sessionError).toBeNull();

      // Verify affinity record was created automatically
      const { data: newAffinity, error: affinityError } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(affinityError).toBeNull();
      expect(newAffinity).not.toBeNull();
      expect(newAffinity!.user_id).toBe(testUserId);
      expect(newAffinity!.beach_id).toBe(testBeachId);
      expect(newAffinity!.session_count).toBe(1);
      expect(newAffinity!.affinity_score).toBeGreaterThan(0);
      expect(newAffinity!.last_surfed_at).toBeTruthy();
    });

    it("should update affinity record when second session is added", async () => {
      // Insert first session
      await supabase.from("sessions").insert({
        user_id: testUserId,
        profile_id: testUserId,
        beach_id: testBeachId,
        arrival_time: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        duration_minutes: 120,
        notes: "First session",
      });

      // Get initial affinity
      const { data: initialAffinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(initialAffinity).not.toBeNull();
      const initialScore = initialAffinity!.affinity_score;

      // Insert second session (more recent)
      await supabase.from("sessions").insert({
        user_id: testUserId,
        profile_id: testUserId,
        beach_id: testBeachId,
        arrival_time: new Date().toISOString(),
        duration_minutes: 90,
        notes: "Second session",
      });

      // Verify affinity was updated
      const { data: updatedAffinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(updatedAffinity).not.toBeNull();
      expect(updatedAffinity!.session_count).toBe(2);
      expect(updatedAffinity!.affinity_score).toBeGreaterThan(initialScore);
      expect(new Date(updatedAffinity!.last_surfed_at!).getTime()).toBeGreaterThan(
        new Date(initialAffinity!.last_surfed_at!).getTime()
      );
    });

    it("should handle concurrent session inserts correctly", async () => {
      // Insert multiple sessions at once
      const sessions = Array.from({ length: 5 }, (_, i) => ({
        user_id: testUserId,
        profile_id: testUserId,
        beach_id: testBeachId,
        arrival_time: new Date(Date.now() - i * 86400000).toISOString(),
        duration_minutes: 120,
        notes: `Session ${i + 1}`,
      }));

      await supabase.from("sessions").insert(sessions);

      // Verify affinity reflects all sessions
      const { data: affinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(affinity).not.toBeNull();
      expect(affinity!.session_count).toBe(5);
      // Should have frequency bonus (5+ sessions)
      expect(affinity!.affinity_score).toBeGreaterThanOrEqual(70);
    });
  });

  describe("UPDATE Trigger Behavior", () => {
    it("should recalculate affinity when session is updated", async () => {
      // Insert a session
      const { data: sessionData } = await supabase
        .from("sessions")
        .insert({
          user_id: testUserId,
          beach_id: testBeachId,
          arrival_time: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          profile_id: testUserId,
          duration_minutes: 120,
          notes: "Original session",
        })
        .select()
        .single();

      expect(sessionData).not.toBeNull();

      // Get initial affinity
      const { data: initialAffinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      const initialScore = initialAffinity!.affinity_score;

      // Update session arrival time to more recent (should increase recency bonus)
      await supabase
        .from("sessions")
        .update({
          arrival_time: new Date().toISOString(),
        })
        .eq("id", sessionData.id);

      // Verify affinity was recalculated
      const { data: updatedAffinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(updatedAffinity).not.toBeNull();
      expect(updatedAffinity!.session_count).toBe(1); // Still 1 session
      expect(updatedAffinity!.affinity_score).toBeGreaterThan(initialScore); // Higher score due to recency
    });
  });

  describe("DELETE Trigger Behavior", () => {
    it("should update affinity when session is deleted", async () => {
      // Insert 2 sessions
      const { data: sessions } = await supabase
        .from("sessions")
        .insert([
          {
            user_id: testUserId,
            profile_id: testUserId,
            beach_id: testBeachId,
            arrival_time: new Date(Date.now() - 86400000).toISOString(),
            duration_minutes: 120,
            notes: "Session 1",
          },
          {
            user_id: testUserId,
            profile_id: testUserId,
            beach_id: testBeachId,
            arrival_time: new Date().toISOString(),
            duration_minutes: 90,
            notes: "Session 2",
          },
        ])
        .select();

      expect(sessions).not.toBeNull();
      expect(sessions!.length).toBe(2);

      // Get initial affinity (should be for 2 sessions)
      const { data: initialAffinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(initialAffinity!.session_count).toBe(2);

      // Delete one session
      await supabase.from("sessions").delete().eq("id", sessions![0].id);

      // Wait for trigger to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify affinity was updated
      const { data: updatedAffinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(updatedAffinity).not.toBeNull();
      expect(updatedAffinity!.session_count).toBe(1); // Now only 1 session
      expect(updatedAffinity!.affinity_score).toBeLessThan(
        initialAffinity!.affinity_score
      );
    });

    it("should remove affinity record when last session is deleted", async () => {
      // Insert 1 session
      const { data: sessionData } = await supabase
        .from("sessions")
        .insert({
          user_id: testUserId,
          beach_id: testBeachId,
          arrival_time: new Date().toISOString(),
          profile_id: testUserId,
          duration_minutes: 120,
          notes: "Only session",
        })
        .select()
        .single();

      expect(sessionData).not.toBeNull();

      // Verify affinity record exists
      const { data: initialAffinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(initialAffinity).not.toBeNull();

      // Delete the session
      await supabase.from("sessions").delete().eq("id", sessionData.id);

      // Verify affinity record was removed
      const { data: deletedAffinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(deletedAffinity).toBeNull();
    });
  });

  describe("Trigger Stability", () => {
    it("should handle rapid session changes without errors", async () => {
      // Insert session
      const { data: session } = await supabase
        .from("sessions")
        .insert({
          user_id: testUserId,
          beach_id: testBeachId,
          arrival_time: new Date().toISOString(),
          profile_id: testUserId,
          duration_minutes: 120,
          notes: "Test",
        })
        .select()
        .single();

      // Rapidly update and delete
      await supabase
        .from("sessions")
        .update({ duration_minutes: 90 })
        .eq("id", session!.id);

      await supabase
        .from("sessions")
        .update({ duration_minutes: 60 })
        .eq("id", session!.id);

      await supabase.from("sessions").delete().eq("id", session!.id);

      // No affinity record should remain
      const { data: affinity } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      expect(affinity).toBeNull();
    });

    it("should maintain data integrity with multiple beaches", async () => {
      // Create second beach
      const { data: beach2 } = await supabase
        .from("beaches")
        .insert({
          name: `Second Beach ${Date.now()}`,
          city: "Test City 2",
          state: "California",
          country: "USA",
          lat: 33.0,
          lon: -118.0,
        })
        .select()
        .single();

      // Insert sessions at different beaches
      await supabase.from("sessions").insert([
        {
          user_id: testUserId,
          beach_id: testBeachId,
          arrival_time: new Date().toISOString(),
          profile_id: testUserId,
          duration_minutes: 120,
          notes: "Beach 1",
        },
        {
          user_id: testUserId,
          beach_id: beach2!.id,
          arrival_time: new Date().toISOString(),
          profile_id: testUserId,
          duration_minutes: 120,
          notes: "Beach 2",
        },
      ]);

      // Verify separate affinity records exist
      const { data: affinities } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId);

      expect(affinities).not.toBeNull();
      expect(affinities!.length).toBe(2);

      // Clean up
      await supabase.from("beaches").delete().eq("id", beach2!.id);
    });
  });

  describe("Upsert Logic", () => {
    it("should handle ON CONFLICT correctly", async () => {
      // Insert session (creates affinity)
      await supabase.from("sessions").insert({
        user_id: testUserId,
        profile_id: testUserId,
        beach_id: testBeachId,
        arrival_time: new Date().toISOString(),
        duration_minutes: 120,
        notes: "Session 1",
      });

      const { data: affinity1 } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId)
        .single();

      // Insert another session (should UPDATE existing affinity, not create new)
      await supabase.from("sessions").insert({
        user_id: testUserId,
        profile_id: testUserId,
        beach_id: testBeachId,
        arrival_time: new Date().toISOString(),
        duration_minutes: 90,
        notes: "Session 2",
      });

      // Should still be only one affinity record
      const { data: affinities } = await supabase
        .from("user_beach_affinity")
        .select("*")
        .eq("user_id", testUserId)
        .eq("beach_id", testBeachId);

      expect(affinities).not.toBeNull();
      expect(affinities!.length).toBe(1);
      expect(affinities![0].id).toBe(affinity1!.id); // Same record ID
      expect(affinities![0].session_count).toBe(2); // Updated count
    });
  });
});
