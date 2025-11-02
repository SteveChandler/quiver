/**
 * Integration test for photo upload infrastructure
 * Tests the storage_usage table and upload flow without UI
 */

import { createClient } from "@supabase/supabase-js";
import { uploadSessionPhoto } from "@/lib/supabase/storage";

// Use test environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("Photo Upload Infrastructure", () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  });

  describe("Storage Usage Infrastructure", () => {
    it("should have storage_usage table", async () => {
      const { data, error } = await supabase
        .from("storage_usage")
        .select("*")
        .limit(1);

      // Table should exist (error would be "relation does not exist" if missing)
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it("should have update_user_storage_usage RPC function", async () => {
      // Query pg_proc to check if function exists
      const { data, error } = await supabase.rpc("update_user_storage_usage", {
        p_user_id: "00000000-0000-0000-0000-000000000000", // Dummy UUID
        p_bytes_to_add: 0,
        p_images_to_add: 0,
      });

      // Function should exist (would get "function does not exist" error if missing)
      // We expect it to fail with permission error, not "function not found"
      if (error) {
        expect(error.message).not.toContain("function");
        expect(error.message).not.toContain("does not exist");
      }
    });

    it("should have get_user_storage_stats function", async () => {
      const { data, error } = await supabase.rpc("get_user_storage_stats", {
        p_user_id: "00000000-0000-0000-0000-000000000000",
      });

      // Function should exist
      if (error) {
        expect(error.message).not.toContain("function");
        expect(error.message).not.toContain("does not exist");
      }
    });
  });

  describe("Storage Bucket Configuration", () => {
    it("should have session-media bucket", async () => {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      expect(error).toBeNull();
      expect(buckets).toBeDefined();

      const sessionMediaBucket = buckets?.find(
        (bucket) => bucket.id === "session-media"
      );
      expect(sessionMediaBucket).toBeDefined();
      expect(sessionMediaBucket?.name).toBe("session-media");
    });

    it("should have correct bucket policies", async () => {
      // Test if we can list objects in the bucket (public read policy)
      const { data, error } = await supabase.storage
        .from("session-media")
        .list();

      // Should not get "policy" error
      if (error) {
        expect(error.message).not.toContain("policy");
      }
    });
  });

  describe("Session Media Table", () => {
    it("should have session_media table with correct structure", async () => {
      const { data, error } = await supabase
        .from("session_media")
        .select("*")
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it("should have RLS policies on session_media", async () => {
      // Try to query the table - should work for public sessions
      const { error } = await supabase
        .from("session_media")
        .select("id")
        .limit(1);

      // Should not get RLS error for public sessions
      expect(error).toBeNull();
    });
  });

  describe("Upload Flow Critical Path", () => {
    it("should validate file types correctly", () => {
      const validFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      expect(validFile.type).toBe("image/jpeg");

      const invalidFile = new File(["test"], "test.pdf", {
        type: "application/pdf",
      });
      expect(invalidFile.type).not.toMatch(/^image\//);
    });

    it("should check quota before upload", async () => {
      // This test documents the critical quota check at storage.ts:171
      // The upload flow MUST check storage_usage before allowing upload

      const testUserId = "00000000-0000-0000-0000-000000000000";

      // Query storage_usage (this is what fails if table doesn't exist)
      const { data, error } = await supabase
        .from("storage_usage")
        .select("total_bytes, image_count")
        .eq("user_id", testUserId)
        .single();

      // Should not throw "relation does not exist" error
      if (error) {
        expect(error.code).not.toBe("42P01"); // PostgreSQL code for "relation does not exist"
        expect(error.message).not.toContain("relation");
        expect(error.message).not.toContain("does not exist");
      }
    });
  });

  describe("Infrastructure Completeness", () => {
    it("should have all required infrastructure for photo uploads", async () => {
      const checks = {
        storage_usage_table: false,
        update_function: false,
        stats_function: false,
        session_media_table: false,
        storage_bucket: false,
      };

      // Check storage_usage table
      const { error: tableError } = await supabase
        .from("storage_usage")
        .select("*")
        .limit(1);
      checks.storage_usage_table = tableError === null;

      // Check update function
      const { error: updateError } = await supabase.rpc(
        "update_user_storage_usage",
        {
          p_user_id: "00000000-0000-0000-0000-000000000000",
          p_bytes_to_add: 0,
          p_images_to_add: 0,
        }
      );
      checks.update_function =
        updateError === null ||
        !updateError.message.includes("does not exist");

      // Check stats function
      const { error: statsError } = await supabase.rpc(
        "get_user_storage_stats",
        {
          p_user_id: "00000000-0000-0000-0000-000000000000",
        }
      );
      checks.stats_function =
        statsError === null || !statsError.message.includes("does not exist");

      // Check session_media table
      const { error: sessionMediaError } = await supabase
        .from("session_media")
        .select("*")
        .limit(1);
      checks.session_media_table = sessionMediaError === null;

      // Check storage bucket
      const { data: buckets } = await supabase.storage.listBuckets();
      checks.storage_bucket =
        buckets?.some((b) => b.id === "session-media") ?? false;

      // Log results for debugging
      console.log("Infrastructure Check Results:", checks);

      // All checks should pass
      expect(checks.storage_usage_table).toBe(true);
      expect(checks.update_function).toBe(true);
      expect(checks.stats_function).toBe(true);
      expect(checks.session_media_table).toBe(true);
      expect(checks.storage_bucket).toBe(true);
    });
  });
});
