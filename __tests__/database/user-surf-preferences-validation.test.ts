/**
 * Validation tests for user surf preferences CHECK constraints
 *
 * Purpose: Verify all CHECK constraints properly validate data according
 * to business rules defined in the migration
 *
 * Tests:
 * - Wave height validation (min >= 0, max >= min)
 * - Wave period validation (min >= 0, max >= min)
 * - Wind speed validation (>= 0)
 * - Wind directions array validation (<= 8 elements)
 * - Tide statuses array validation (<= 6 elements)
 * - Confidence score validation (0-1 range)
 * - Sample size validation (>= 0)
 * - UNIQUE constraint on user_id
 *
 * @jest-environment node
 */

import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const shouldRunDatabase =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// Restore real fetch for database tests.
// jest.setup.js installs a mocked fetch for UI/server-action tests; these database tests
// need a real fetch implementation for Supabase admin calls.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const undici = require("undici");
// @ts-ignore
global.fetch = undici.fetch;
// @ts-ignore
global.Headers = undici.Headers;
// @ts-ignore
global.Request = undici.Request;
// @ts-ignore
global.Response = undici.Response;

// IMPORTANT: require supabase-js after installing a real fetch.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");

(shouldRunDatabase ? describe : describe.skip)(
  "User Surf Preferences Check Constraints",
  () => {
  let supabaseAdmin: ReturnType<typeof createClient<Database>>;
  let testUserId: string;

  beforeAll(async () => {
    if (!supabaseServiceKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY not set. Required for validation tests."
      );
    }

    supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Create a test user for validation tests
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email: `prefs-validation-${Date.now()}@test.com`,
        password: "test-password-123",
        email_confirm: true,
      });

    if (userError || !userData.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }

    testUserId = userData.user.id;
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
    }
  });

  afterEach(async () => {
    // Clean up test preferences after each test
    await supabaseAdmin
      .from("user_surf_preferences")
      .delete()
      .eq("user_id", testUserId);
  });

  describe("Wave Height Validation", () => {
    it("should reject negative wave_min_ft", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        wave_min_ft: -1.0,
        wave_max_ft: 8.0,
        confidence: 0.5,
        sample_size: 5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should reject wave_max_ft < wave_min_ft", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        wave_min_ft: 8.0,
        wave_max_ft: 2.0, // Max less than min - invalid
        confidence: 0.5,
        sample_size: 5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should accept valid wave height range", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          wave_min_ft: 2.0,
          wave_max_ft: 8.0,
          confidence: 0.5,
          sample_size: 5,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.wave_min_ft).toBe(2.0);
      expect(data?.wave_max_ft).toBe(8.0);
    });

    it("should accept null wave heights", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          wave_min_ft: null,
          wave_max_ft: null,
          confidence: 0.3, // Lower confidence with insufficient data
          sample_size: 3,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.wave_min_ft).toBeNull();
      expect(data?.wave_max_ft).toBeNull();
    });
  });

  describe("Wave Period Validation", () => {
    it("should reject negative wave_period_min_s", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        wave_period_min_s: -5.0,
        wave_period_max_s: 15.0,
        confidence: 0.5,
        sample_size: 5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should reject wave_period_max_s < wave_period_min_s", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        wave_period_min_s: 15.0,
        wave_period_max_s: 8.0, // Max less than min - invalid
        confidence: 0.5,
        sample_size: 5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should accept valid wave period range", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          wave_period_min_s: 8.0,
          wave_period_max_s: 15.0,
          confidence: 0.5,
          sample_size: 5,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.wave_period_min_s).toBe(8.0);
      expect(data?.wave_period_max_s).toBe(15.0);
    });
  });

  describe("Wind Speed Validation", () => {
    it("should reject negative max_wind_mph", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        max_wind_mph: -10.0,
        confidence: 0.5,
        sample_size: 5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should accept valid max_wind_mph", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          max_wind_mph: 15.5,
          confidence: 0.5,
          sample_size: 5,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.max_wind_mph).toBe(15.5);
    });

    it("should accept null max_wind_mph", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          max_wind_mph: null,
          confidence: 0.3,
          sample_size: 3,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.max_wind_mph).toBeNull();
    });
  });

  describe("Wind Directions Array Validation", () => {
    it("should reject wind directions array > 8 elements", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        preferred_wind_directions: [0, 45, 90, 135, 180, 225, 270, 315, 360], // 9 elements - invalid
        confidence: 0.5,
        sample_size: 5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should accept valid wind directions array (up to 8 elements)", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          preferred_wind_directions: [0, 45, 90, 135, 180, 225, 270, 315], // 8 elements - valid
          confidence: 0.5,
          sample_size: 5,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.preferred_wind_directions).toHaveLength(8);
    });

    it("should accept null wind directions", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          preferred_wind_directions: null,
          confidence: 0.3,
          sample_size: 3,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.preferred_wind_directions).toBeNull();
    });

    it("should accept empty wind directions array", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          preferred_wind_directions: [],
          confidence: 0.3,
          sample_size: 3,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.preferred_wind_directions).toEqual([]);
    });
  });

  describe("Tide Statuses Array Validation", () => {
    it("should reject tide statuses array > 6 elements", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        preferred_tide_statuses: [
          "rising",
          "falling",
          "high",
          "low",
          "incoming",
          "outgoing",
          "slack",
        ], // 7 elements - invalid
        confidence: 0.5,
        sample_size: 5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should accept valid tide statuses array (up to 6 elements)", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          preferred_tide_statuses: ["rising", "falling", "high", "low", "incoming", "outgoing"], // 6 elements - valid
          confidence: 0.5,
          sample_size: 5,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.preferred_tide_statuses).toHaveLength(6);
    });

    it("should accept null tide statuses", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          preferred_tide_statuses: null,
          confidence: 0.3,
          sample_size: 3,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.preferred_tide_statuses).toBeNull();
    });
  });

  describe("Confidence Validation", () => {
    it("should reject confidence < 0", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        confidence: -0.1,
        sample_size: 5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should reject confidence > 1", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        confidence: 1.1,
        sample_size: 5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should accept valid confidence values", async () => {
      const testCases = [0.0, 0.5, 0.95, 1.0];

      for (const conf of testCases) {
        const { data, error } = await supabaseAdmin
          .from("user_surf_preferences")
          .insert({
            user_id: testUserId,
            confidence: conf,
            sample_size: 5,
          })
          .select()
          .single();

        expect(error).toBeNull();
        expect(data?.confidence).toBe(conf);

        // Clean up for next iteration
        await supabaseAdmin
          .from("user_surf_preferences")
          .delete()
          .eq("user_id", testUserId);
      }
    });
  });

  describe("Sample Size Validation", () => {
    it("should reject negative sample_size", async () => {
      const { error } = await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        confidence: 0.0,
        sample_size: -5,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("violates check constraint");
    });

    it("should accept sample_size = 0", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          confidence: 0.0,
          sample_size: 0,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.sample_size).toBe(0);
    });

    it("should accept valid sample_size values", async () => {
      const testCases = [5, 20, 100];

      for (const size of testCases) {
        const { data, error } = await supabaseAdmin
          .from("user_surf_preferences")
          .insert({
            user_id: testUserId,
            confidence: 0.5,
            sample_size: size,
          })
          .select()
          .single();

        expect(error).toBeNull();
        expect(data?.sample_size).toBe(size);

        // Clean up for next iteration
        await supabaseAdmin
          .from("user_surf_preferences")
          .delete()
          .eq("user_id", testUserId);
      }
    });
  });

  describe("UNIQUE Constraint on user_id", () => {
    it("should reject duplicate user_id", async () => {
      // Insert first record
      const { error: insertError } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          confidence: 0.5,
          sample_size: 5,
        });

      expect(insertError).toBeNull();

      // Try to insert duplicate
      const { error: duplicateError } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId, // Same user_id - should fail
          confidence: 0.7,
          sample_size: 10,
        });

      expect(duplicateError).not.toBeNull();
      expect(duplicateError?.message).toContain("duplicate key value");
    });

    it("should allow update to existing user_id record", async () => {
      // Insert record
      await supabaseAdmin.from("user_surf_preferences").insert({
        user_id: testUserId,
        confidence: 0.5,
        sample_size: 5,
      });

      // Update should work (upsert pattern)
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .update({
          confidence: 0.8,
          sample_size: 15,
        })
        .eq("user_id", testUserId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.confidence).toBe(0.8);
      expect(data?.sample_size).toBe(15);
    });
  });

  describe("Complete Preference Record", () => {
    it("should accept complete preference record with all fields", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_surf_preferences")
        .insert({
          user_id: testUserId,
          wave_min_ft: 2.5,
          wave_max_ft: 7.0,
          wave_period_min_s: 9.0,
          wave_period_max_s: 14.0,
          max_wind_mph: 12.0,
          preferred_wind_directions: [270, 315, 0], // W, NW, N
          preferred_tide_statuses: ["rising", "high"],
          confidence: 0.85,
          sample_size: 25,
          last_computed_at: new Date().toISOString(),
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.wave_min_ft).toBe(2.5);
      expect(data?.wave_max_ft).toBe(7.0);
      expect(data?.wave_period_min_s).toBe(9.0);
      expect(data?.wave_period_max_s).toBe(14.0);
      expect(data?.max_wind_mph).toBe(12.0);
      expect(data?.preferred_wind_directions).toEqual([270, 315, 0]);
      expect(data?.preferred_tide_statuses).toEqual(["rising", "high"]);
      expect(data?.confidence).toBe(0.85);
      expect(data?.sample_size).toBe(25);
      expect(data?.last_computed_at).not.toBeNull();
    });
  });
});
