#!/usr/bin/env node
/**
 * Drives the REAL Next.js API routes against LOCAL Supabase with a genuine
 * signed-in JWT. Complements roundtrip-session-video.mjs, which exercises the
 * database/storage layer directly.
 *
 * Requires: yarn db:local  +  next dev on APP (default :3200)
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

const APP = process.env.APP ?? "http://127.0.0.1:3200";
const status = JSON.parse(execFileSync("supabase", ["status", "-o", "json"]).toString());
const { API_URL: URL, ANON_KEY: ANON, SERVICE_ROLE_KEY: SERVICE } = status;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const rnd = process.argv[2] ?? "http1";
const password = "Test-Passw0rd!";
const mkUser = async (mail) => {
  const { data, error } = await admin.auth.admin.createUser({ email: mail, password, email_confirm: true });
  if (error) throw new Error(error.message);
  await admin.from("profiles").insert({ id: data.user.id });
  return data.user;
};

console.log("=== setup ===");
const owner = await mkUser(`http-${rnd}@example.test`);
const stranger = await mkUser(`http-${rnd}-other@example.test`);
const { data: beach } = await admin.from("beaches").select("id,name").limit(1).single();
const { data: session } = await admin.from("sessions")
  .insert({ user_id: owner.id, beach_id: beach.id, is_public: true }).select("id").single();
console.log(`  owner=${owner.id.slice(0, 8)}  session=${session.id.slice(0, 8)}`);

const tokenFor = async (mail) => {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: mail, password });
  if (error) throw new Error(error.message);
  return { token: data.session.access_token, client: c };
};
const o = await tokenFor(`http-${rnd}@example.test`);
const s = await tokenFor(`http-${rnd}-other@example.test`);

const post = (path, token, body) =>
  fetch(`${APP}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: ANON },
    body: JSON.stringify(body),
  });

const clip = Buffer.from("\x00\x00\x00\x18ftypmp42" + "x".repeat(4096));
const path = `${session.id}/${owner.id}/http-${rnd}.mp4`;
await o.client.storage.from("session-videos").upload(path, clip, { contentType: "video/mp4", upsert: true });

console.log("\n=== POST /api/sessions/[id]/videos — validation ===");
let r = await post(`/api/sessions/${session.id}/videos`, o.token, { storagePath: path, durationSec: 90, sizeBytes: clip.length });
check("duration > 60s rejected", r.status === 422, `HTTP ${r.status} ${(await r.json()).error ?? ""}`);

r = await post(`/api/sessions/${session.id}/videos`, o.token, { storagePath: path, durationSec: 12, sizeBytes: 99_000_000 });
check("size > 60MB rejected", r.status === 422, `HTTP ${r.status} ${(await r.json()).error ?? ""}`);

r = await post(`/api/sessions/${session.id}/videos`, o.token, { storagePath: `evil/${owner.id}/x.mp4`, durationSec: 12, sizeBytes: clip.length });
check("wrong storage path prefix rejected", r.status === 422, `HTTP ${r.status} ${(await r.json()).error ?? ""}`);

r = await post(`/api/sessions/${session.id}/videos`, o.token, { storagePath: `${session.id}/${owner.id}/x.avi`, durationSec: 12, sizeBytes: clip.length });
check("non mp4/mov extension rejected", r.status === 422, `HTTP ${r.status} ${(await r.json()).error ?? ""}`);

console.log("\n=== authorization ===");
r = await post(`/api/sessions/${session.id}/videos`, undefined, { storagePath: path, durationSec: 12, sizeBytes: clip.length });
check("unauthenticated rejected", r.status === 401 || r.status === 403, `HTTP ${r.status}`);

r = await post(`/api/sessions/${session.id}/videos`, s.token, { storagePath: path, durationSec: 12, sizeBytes: clip.length });
check("non-owner cannot finalize onto someone else's session", r.status >= 400, `HTTP ${r.status}`);

console.log("\n=== happy path ===");
r = await post(`/api/sessions/${session.id}/videos`, o.token, { storagePath: path, durationSec: 12, sizeBytes: clip.length });
const created = r.ok ? await r.json() : null;
check("owner finalize returns 201", r.status === 201, `HTTP ${r.status}`);
check("response carries mediaId", !!created?.mediaId, created?.mediaId ?? "");

const { data: row } = await admin.from("session_media").select("moderation_status,media_type,metadata").eq("id", created?.mediaId ?? "").maybeSingle();
check("row persisted as pending video", row?.moderation_status === "pending" && row?.media_type === "video", `${row?.moderation_status}/${row?.media_type}`);
check("durationSec stored in metadata", row?.metadata?.durationSec === 12, JSON.stringify(row?.metadata ?? {}));

console.log("\n=== GET signed playback route ===");
const get = (token) =>
  fetch(`${APP}/api/sessions/${session.id}/videos/${created?.mediaId}`, {
    headers: token ? { Authorization: `Bearer ${token}`, apikey: ANON } : { apikey: ANON },
  });

r = await get(undefined);
check("anonymous DENIED while pending", r.status >= 400, `HTTP ${r.status}`);
r = await get(s.token);
check("other user DENIED while pending", r.status >= 400, `HTTP ${r.status}`);
r = await get(o.token);
check("owner ALLOWED while pending", r.ok, `HTTP ${r.status}`);

await admin.from("session_media").update({ moderation_status: "approved" }).eq("id", created?.mediaId);
r = await get(undefined);
const signed = r.ok ? await r.json() : null;
check("anonymous ALLOWED after approval", r.ok, `HTTP ${r.status}`);
check("signed url returned + expiry", !!signed?.url && signed?.expiresIn === 300, `expiresIn=${signed?.expiresIn}`);
if (signed?.url) {
  const play = await fetch(signed.url);
  check("signed url plays the object", play.ok, `HTTP ${play.status}`);
}

console.log("\n=== cleanup ===");
await admin.from("session_media").delete().eq("id", created?.mediaId ?? "00000000-0000-0000-0000-000000000000");
await admin.from("sessions").delete().eq("id", session.id);
await admin.storage.from("session-videos").remove([path]);
for (const u of [owner, stranger]) await admin.auth.admin.deleteUser(u.id);
console.log("  cleaned up");

console.log(`\n${fail === 0 ? "ALL CHECKS PASSED" : "FAILURES PRESENT"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
