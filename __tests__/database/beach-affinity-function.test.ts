/**
 * Unit tests for beach affinity computation function
 *
 * Purpose: Verify the compute_beach_affinity() function correctly calculates
 * beach affinity scores based on session frequency, recency, and consistency
 *
 * Algorithm:
 * - Base score: 10 points per session (capped at 50)
 * - Recency bonus: 30 points max, exponential decay over 180 days
 * - Frequency bonus: +20 points if 5+ sessions
 * - Final score: 0-100 range
 *
 * @jest-environment node
 */

import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// For admin operations in tests, use service role key
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const shouldRunDatabase =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

// Restore real fetch for database tests.
// jest.setup.js installs a mocked fetch for UI/server-action tests; these database tests
// need a real fetch implementation for Supabase anon/admin calls.
 
const undici = require("undici");
global.fetch = undici.fetch;
global.Headers = undici.Headers;
global.Request = undici.Request;
global.Response = undici.Response;

// IMPORTANT: require supabase-js after installing a real fetch.
 
const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");

(shouldRunDatabase ? describe : describe.skip)(
  "Beach Affinity Computation Function",
  () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let adminClient: ReturnType<typeof createClient<Database>>;
  let testUserId: string;
  let testBeachId: string;

  beforeAll(() => {
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
    // Create admin client with service role key for user management
    adminClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  });

  beforeEach(async () => {
    // Create test user (using admin client with service role)
    const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
      email: `test-beach-affinity-${Date.now()}@test.com`,
      password: "test-password-123",
      email_confirm: true,
    });

    if (userError || !userData.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }

    testUserId = userData.user.id;

    // Create test beach (using admin client to bypass RLS)
    const { data: beachData, error: beachError } = await adminClient
      .from("beaches")
      .insert({
        name: `Test Beach ${Date.now()}`,
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
  });

  afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      // Delete sessions (will cascade to affinity via trigger)
      await supabase
        .from("sessions")
        .delete()
        .eq("user_id", testUserId);

      // Delete user (using admin client)
      await adminClient.auth.admin.deleteUser(testUserId);
    }

    if (testBeachId) {
      // Delete beach (using admin client to bypass RLS)
      await adminClient
        .from("beaches")
        .delete()
        .eq("id", testBeachId);
    }
  });

  describe("Zero Sessions", () => {
    it("should return 0 affinity when user has no sessions", async () => {
      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();
      expect(data).toBe(0);
    });
  });

  describe("Base Score Calculation", () => {
    it("should return base score of 10 for 1 session (no frequency bonus)", async () => {
      // Create 1 session
      await createSession(testUserId, testBeachId, new Date());

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();
      expect(data).toBeGreaterThan(0);

      // Base score is 10, plus some recency bonus (recent session)
      // Should be > 10 but < 50 (base cap + recency bonus)
      expect(data).toBeGreaterThanOrEqual(10);
      expect(data).toBeLessThan(50);
    });

    it("should cap base score at 50 for 5+ sessions", async () => {
      // Create 5 sessions (all recent)
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        await createSession(testUserId, testBeachId, new Date(now.getTime() - i * 1000));
      }

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Base: 50 (5*10), Frequency: +20 (5+ sessions), Recency: ~30 (recent)
      // Total should be near 100
      expect(data).toBeGreaterThanOrEqual(90);
      expect(data).toBeLessThanOrEqual(100);
    });

    it("should not exceed base score of 50 even with 10 sessions", async () => {
      // Create 10 sessions (all old to minimize recency bonus)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 365); // 1 year ago

      for (let i = 0; i < 10; i++) {
        await createSession(testUserId, testBeachId, new Date(oldDate.getTime() - i * 1000));
      }

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Base: 50 (capped), Frequency: +20, Recency: ~0-4 (very old, minimal decay)
      // Total should be around 70-74
      expect(data).toBeGreaterThanOrEqual(68);
      expect(data).toBeLessThanOrEqual(75);
    });
  });

  describe("Recency Bonus Calculation", () => {
    it("should give high recency bonus for very recent session", async () => {
      // Session from today
      await createSession(testUserId, testBeachId, new Date());

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Base: 10, Recency: ~30 (recent), Frequency: 0
      // Total should be close to 40
      expect(data).toBeGreaterThanOrEqual(35);
      expect(data).toBeLessThanOrEqual(42);
    });

    it("should give medium recency bonus for session 90 days ago", async () => {
      // Session from 90 days ago (half-life point)
      const date90DaysAgo = new Date();
      date90DaysAgo.setDate(date90DaysAgo.getDate() - 90);

      await createSession(testUserId, testBeachId, date90DaysAgo);

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Base: 10, Recency: ~18 (exp(-90/180) ≈ 0.606, so 30*0.606 ≈ 18), Frequency: 0
      // Total should be around 28
      expect(data).toBeGreaterThanOrEqual(25);
      expect(data).toBeLessThanOrEqual(31);
    });

    it("should give low recency bonus for very old session (180+ days)", async () => {
      // Session from 180 days ago
      const dateOld = new Date();
      dateOld.setDate(dateOld.getDate() - 180);

      await createSession(testUserId, testBeachId, dateOld);

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Base: 10, Recency: ~11 (exp(-180/180) ≈ 0.368, so 30*0.368 ≈ 11), Frequency: 0
      // Total should be around 21
      expect(data).toBeGreaterThanOrEqual(18);
      expect(data).toBeLessThanOrEqual(24);
    });

    it("should use most recent session for recency calculation", async () => {
      // Create old session
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 180);
      await createSession(testUserId, testBeachId, oldDate);

      // Create recent session
      await createSession(testUserId, testBeachId, new Date());

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Base: 20 (2 sessions), Recency: ~30 (most recent), Frequency: 0
      // Total should be around 50
      expect(data).toBeGreaterThanOrEqual(47);
      expect(data).toBeLessThanOrEqual(53);
    });
  });

  describe("Frequency Bonus Calculation", () => {
    it("should not add frequency bonus for 4 sessions", async () => {
      // Create 4 old sessions (to isolate frequency bonus)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 365);

      for (let i = 0; i < 4; i++) {
        await createSession(testUserId, testBeachId, new Date(oldDate.getTime() - i * 1000));
      }

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Base: 40 (4*10), Frequency: 0, Recency: ~0-4 (very old, minimal decay)
      // Total should be around 40-44
      expect(data).toBeGreaterThanOrEqual(38);
      expect(data).toBeLessThanOrEqual(45);
    });

    it("should add +20 frequency bonus for exactly 5 sessions", async () => {
      // Create 5 old sessions
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 365);

      for (let i = 0; i < 5; i++) {
        await createSession(testUserId, testBeachId, new Date(oldDate.getTime() - i * 1000));
      }

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Base: 50 (5*10, capped), Frequency: +20, Recency: ~0-4 (very old, minimal decay)
      // Total should be around 70-74
      expect(data).toBeGreaterThanOrEqual(68);
      expect(data).toBeLessThanOrEqual(75);
    });

    it("should add +20 frequency bonus for 10+ sessions", async () => {
      // Create 10 old sessions
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 365);

      for (let i = 0; i < 10; i++) {
        await createSession(testUserId, testBeachId, new Date(oldDate.getTime() - i * 1000));
      }

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Base: 50 (capped), Frequency: +20, Recency: ~0-4 (very old, minimal decay)
      // Total should be around 70-74 (same as 5 sessions since base is capped)
      expect(data).toBeGreaterThanOrEqual(68);
      expect(data).toBeLessThanOrEqual(75);
    });
  });

  describe("Score Capping", () => {
    it("should cap total affinity at 100", async () => {
      // Create many recent sessions to maximize score
      const now = new Date();
      for (let i = 0; i < 20; i++) {
        await createSession(testUserId, testBeachId, new Date(now.getTime() - i * 1000));
      }

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();

      // Should be capped at 100
      expect(data).toBe(100);
    });
  });

  describe("Edge Cases", () => {
    it("should handle non-existent user gracefully", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: fakeUserId,
        _beach_id: testBeachId,
      });

      expect(error).toBeNull();
      expect(data).toBe(0); // No sessions = 0 affinity
    });

    it("should handle non-existent beach gracefully", async () => {
      const fakeBeachId = "00000000-0000-0000-0000-000000000000";

      const { data, error } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: fakeBeachId,
      });

      expect(error).toBeNull();
      expect(data).toBe(0); // No sessions = 0 affinity
    });

    it("should be stable and deterministic", async () => {
      // Create 3 sessions
      const date = new Date();
      for (let i = 0; i < 3; i++) {
        await createSession(testUserId, testBeachId, new Date(date.getTime() - i * 1000));
      }

      // Compute affinity twice
      const { data: result1 } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      const { data: result2 } = await supabase.rpc("compute_beach_affinity", {
        _user_id: testUserId,
        _beach_id: testBeachId,
      });

      // Should be identical
      expect(result1).toBe(result2);
    });
  });

  // Helper function to create test sessions
  async function createSession(userId: string, beachId: string, arrivalTime: Date) {
    // First, get or create a profile for the user
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to check profile: ${profileError.message}`);
    }

    // If profile doesn't exist, create it
    if (!profile) {
      const { error: createProfileError } = await adminClient
        .from("profiles")
        .insert({
          id: userId,
          username: `test-user-${userId.slice(0, 8)}`,
        });

      if (createProfileError) {
        throw new Error(`Failed to create profile: ${createProfileError.message}`);
      }
    }

    const { error } = await adminClient.from("sessions").insert({
      user_id: userId,
      beach_id: beachId,
      arrival_time: arrivalTime.toISOString(),
      duration_minutes: 120, // 2 hours (replaces departure_time)
      notes: "Test session",
    });

    if (error) {
      throw new Error(`Failed to create test session: ${error.message}`);
    }
  }
});
