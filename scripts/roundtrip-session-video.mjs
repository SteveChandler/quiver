#!/usr/bin/env node
/**
 * End-to-end round trip for session video UGC against LOCAL Supabase.
 * Exercises real auth, real storage RLS, real table RLS, real signed URLs.
 *
 * Requires: yarn db:local
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

const status = JSON.parse(execFileSync("supabase", ["status", "-o", "json"], { cwd: process.cwd() }).toString());
const URL = status.API_URL, ANON = status.ANON_KEY, SERVICE = status.SERVICE_ROLE_KEY;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const rnd = process.argv[2] ?? "rt1";
const email = `roundtrip-${rnd}@example.test`;
const other = `roundtrip-${rnd}-other@example.test`;
const password = "Test-Passw0rd!";

console.log("=== setup ===");
const mk = async (mail) => {
  const { data, error } = await admin.auth.admin.createUser({ email: mail, password, email_confirm: true });
  if (error) throw new Error(`createUser ${mail}: ${error.message}`);
  // The auth.users -> profiles trigger lives in the auth schema, which
  // `supabase db dump` does not capture, so create the profile explicitly.
  const { error: pErr } = await admin.from("profiles").insert({ id: data.user.id });
  if (pErr && !/duplicate/i.test(pErr.message)) throw new Error(`create profile ${mail}: ${pErr.message}`);
  return data.user;
};
const owner = await mk(email);
const stranger = await mk(other);
console.log(`  owner=${owner.id.slice(0, 8)}  stranger=${stranger.id.slice(0, 8)}`);

const { data: beach } = await admin.from("beaches").select("id,name").limit(1).single();
const { data: session, error: sErr } = await admin
  .from("sessions")
  .insert({ user_id: owner.id, beach_id: beach.id, is_public: true })
  .select("id").single();
if (sErr) throw new Error(`create session: ${sErr.message}`);
console.log(`  public session ${session.id.slice(0, 8)} at ${beach.name}`);

// authenticated clients
const asUser = async (mail) => {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: mail, password });
  if (error) throw new Error(`signIn ${mail}: ${error.message}`);
  return c;
};
const ownerClient = await asUser(email);
const strangerClient = await asUser(other);

const clip = Buffer.from("\x00\x00\x00\x18ftypmp42" + "x".repeat(2048));

console.log("\n=== 1. storage RLS: path layout ===");
const goodPath = `${session.id}/${owner.id}/clip-${rnd}.mp4`;
const badPath = `${owner.id}/${session.id}/clip-${rnd}.mp4`; // segments swapped

const up1 = await ownerClient.storage.from("session-videos").upload(goodPath, clip, { contentType: "video/mp4", upsert: true });
check("owner uploads to {sessionId}/{userId}/", !up1.error, up1.error?.message);

const up2 = await ownerClient.storage.from("session-videos").upload(badPath, clip, { contentType: "video/mp4", upsert: true });
check("swapped path {userId}/{sessionId}/ is REJECTED", !!up2.error, up2.error ? "rejected" : "ACCEPTED — policy not enforcing");

const up3 = await strangerClient.storage.from("session-videos").upload(`${session.id}/${owner.id}/steal-${rnd}.mp4`, clip, { contentType: "video/mp4", upsert: true });
check("another user cannot write into owner's folder", !!up3.error, up3.error ? "rejected" : "ACCEPTED — leak");

console.log("\n=== 2. finalize (mirrors POST /api/sessions/[id]/videos) ===");
const { data: media, error: mErr } = await ownerClient
  .from("session_media")
  .insert({
    session_id: session.id, user_id: owner.id, storage_path: goodPath, public_url: "",
    file_size: clip.length, media_type: "video", metadata: { durationSec: 12 },
    moderation_status: "pending", thumbnail_path: null,
  })
  .select("id, moderation_status").single();
check("insert with moderation_status + thumbnail_path succeeds", !mErr, mErr?.message);
check("row lands as pending", media?.moderation_status === "pending", media?.moderation_status);

console.log("\n=== 3. table RLS on the pending video ===");
const seesVideo = async (c, label) => {
  const { data } = await c.from("session_media").select("id").eq("id", media?.id ?? "00000000-0000-0000-0000-000000000000");
  return (data ?? []).length;
};
check("anonymous CANNOT see pending video", (await seesVideo(anon)) === 0);
check("other logged-in user CANNOT see pending video", (await seesVideo(strangerClient)) === 0);
check("owner CAN see own pending video", (await seesVideo(ownerClient)) === 1);

console.log("\n=== 4. admin moderation queue ===");
const { data: queue } = await admin
  .from("session_media").select("id,moderation_status").eq("media_type", "video").eq("moderation_status", "pending");
check("pending video appears in the moderation queue", (queue ?? []).some((r) => r.id === media?.id), `queue size ${queue?.length ?? 0}`);

const { error: apErr } = await admin.from("session_media").update({ moderation_status: "approved" }).eq("id", media?.id);
check("admin approve succeeds", !apErr, apErr?.message);

console.log("\n=== 5. visibility after approval ===");
check("anonymous CAN now see the approved video", (await seesVideo(anon)) === 1);

console.log("\n=== 6. signed URL playback ===");
const { data: signed, error: signErr } = await admin.storage.from("session-videos").createSignedUrl(goodPath, 300);
check("signed URL generated", !!signed?.signedUrl, signErr?.message);
if (signed?.signedUrl) {
  const res = await fetch(signed.signedUrl);
  check("signed URL actually serves the object", res.ok, `HTTP ${res.status}`);
  const raw = await fetch(`${URL}/storage/v1/object/session-videos/${goodPath}`);
  check("unsigned direct fetch is denied (private bucket)", !raw.ok, `HTTP ${raw.status}`);
}

console.log("\n=== cleanup ===");
await admin.from("session_media").delete().eq("id", media?.id);
await admin.from("sessions").delete().eq("id", session.id);
await admin.storage.from("session-videos").remove([goodPath, badPath]);
for (const u of [owner, stranger]) await admin.auth.admin.deleteUser(u.id);
console.log("  removed test rows, objects, and users");

console.log(`\n${fail === 0 ? "ALL CHECKS PASSED" : "FAILURES PRESENT"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
