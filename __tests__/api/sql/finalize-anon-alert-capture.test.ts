// SQL-level test of finalize_anon_alert_capture RPC.
//
// SKIPPED on this branch because local supabase db reset is broken on
// pre-existing migration-history defects (see plan amendment "Execution
// amendment (2026-04-26): mocked-Supabase pivot"). Unskip after the
// migration-replay-repair branch lands, OR run against Vercel Preview as
// part of Phase-3 validation.
//
// The RPC behavior is also exercised indirectly via the mocked
// callback-anon-alert-finalization.test.ts (treats the RPC as a black box
// returning canned rows), but only this file proves the SQL body itself.

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const TEST_BEACH_ID = "33333333-3333-3333-3333-333333333333";
const TEST_USER_ID = "44444444-4444-4444-4444-444444444444";

describe.skip("finalize_anon_alert_capture RPC", () => {
  // To re-enable: ensure local supabase db reset succeeds, regenerate types,
  // and remove the .skip. The body below mirrors the plan's Task 18 spec.
  //
  // beforeAll(async () => {
  //   const supabase = await createSupabaseServiceRoleClient();
  //   await supabase.from("beaches").upsert({
  //     id: TEST_BEACH_ID,
  //     name: "RPC Test Beach",
  //     slug: "rpc-test-beach",
  //     center_lat: 32.85,
  //     center_lng: -117.25,
  //     timezone: "America/Los_Angeles",
  //   });
  //   await supabase.from("profiles").upsert({
  //     id: TEST_USER_ID,
  //     email: "rpc-test@example.com",
  //   });
  // });
  //
  // const supabase = await createSupabaseServiceRoleClient();
  //
  // beforeEach(async () => {
  //   await supabase.from("alert_rules").delete().eq("user_id", TEST_USER_ID);
  //   await supabase.from("pending_alert_captures").delete().eq("email", "rpc-test@example.com");
  //   await supabase.from("profiles").update({ home_beach_id: null }).eq("id", TEST_USER_ID);
  // });
  //
  // it("multi-materializes all unconsumed captures in captured_at order", async () => {
  //   await supabase.from("pending_alert_captures").insert([
  //     { email: "rpc-test@example.com", beach_id: TEST_BEACH_ID, preset_type: "glass_off", return_path: "/a", captured_at: new Date(Date.now() - 2 * 60_000).toISOString() },
  //     { email: "rpc-test@example.com", beach_id: TEST_BEACH_ID, preset_type: "big_day", return_path: "/b", captured_at: new Date(Date.now() - 1 * 60_000).toISOString() },
  //   ]);
  //
  //   const { data, error } = await supabase.rpc("finalize_anon_alert_capture", {
  //     p_user_id: TEST_USER_ID,
  //     p_email: "rpc-test@example.com",
  //   });
  //   if (error) throw error;
  //   expect(data).toHaveLength(2);
  //   expect(data![0].preset_type).toBe("glass_off"); // earlier
  //   expect(data![1].preset_type).toBe("big_day");
  //
  //   const { data: rules } = await supabase
  //     .from("alert_rules")
  //     .select("preset_type")
  //     .eq("user_id", TEST_USER_ID);
  //   expect(rules).toHaveLength(2);
  //
  //   const { data: profile } = await supabase
  //     .from("profiles")
  //     .select("home_beach_id, signup_context")
  //     .eq("id", TEST_USER_ID)
  //     .single();
  //   expect(profile?.home_beach_id).toBe(TEST_BEACH_ID);
  //   expect(profile?.signup_context).toMatchObject({ entrypoint: "anon_alert_capture" });
  // });
  //
  // it("ignores expired captures", async () => {
  //   await supabase.from("pending_alert_captures").insert({
  //     email: "rpc-test@example.com",
  //     beach_id: TEST_BEACH_ID,
  //     preset_type: "glass_off",
  //     return_path: "/a",
  //     expires_at: new Date(Date.now() - 60_000).toISOString(),
  //   });
  //   const { data } = await supabase.rpc("finalize_anon_alert_capture", {
  //     p_user_id: TEST_USER_ID,
  //     p_email: "rpc-test@example.com",
  //   });
  //   expect(data).toHaveLength(0);
  // });
  //
  // it("ignores already-consumed captures", async () => {
  //   await supabase.from("pending_alert_captures").insert({
  //     email: "rpc-test@example.com",
  //     beach_id: TEST_BEACH_ID,
  //     preset_type: "glass_off",
  //     return_path: "/a",
  //     consumed_at: new Date().toISOString(),
  //     consumed_user_id: TEST_USER_ID,
  //   });
  //   const { data } = await supabase.rpc("finalize_anon_alert_capture", {
  //     p_user_id: TEST_USER_ID,
  //     p_email: "rpc-test@example.com",
  //   });
  //   expect(data).toHaveLength(0);
  // });
  //
  // it("does not overwrite home_beach_id if already set", async () => {
  //   const OTHER_BEACH = "55555555-5555-5555-5555-555555555555";
  //   await supabase.from("beaches").upsert({
  //     id: OTHER_BEACH,
  //     name: "Other Beach",
  //     slug: "other-beach",
  //     center_lat: 32.85,
  //     center_lng: -117.25,
  //     timezone: "America/Los_Angeles",
  //   });
  //   await supabase.from("profiles").update({ home_beach_id: OTHER_BEACH }).eq("id", TEST_USER_ID);
  //   await supabase.from("pending_alert_captures").insert({
  //     email: "rpc-test@example.com",
  //     beach_id: TEST_BEACH_ID,
  //     preset_type: "glass_off",
  //     return_path: "/a",
  //   });
  //   await supabase.rpc("finalize_anon_alert_capture", {
  //     p_user_id: TEST_USER_ID,
  //     p_email: "rpc-test@example.com",
  //   });
  //   const { data: profile } = await supabase
  //     .from("profiles")
  //     .select("home_beach_id")
  //     .eq("id", TEST_USER_ID)
  //     .single();
  //   expect(profile?.home_beach_id).toBe(OTHER_BEACH);
  // });
  it("placeholder so describe.skip has a body", () => {
    // Reference the imports so unused-import lints don't fire when the
    // describe is skipped. No-op at runtime.
    void createSupabaseServiceRoleClient;
    void TEST_BEACH_ID;
    void TEST_USER_ID;
  });
});
