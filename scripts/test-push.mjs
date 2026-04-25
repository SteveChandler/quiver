#!/usr/bin/env node
// One-off diagnostic — sends a Firebase Admin test push to stcha0004's most
// recent web FCM token. Mirrors lib/services/push-notifications.ts#sendViaFirebase.
// Usage: node scripts/test-push.mjs
//
// Exit codes: 0 = success (at least one token delivered), 1 = all failed / config error

import { config as loadEnv } from "dotenv";
import admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, "..", ".env") });
loadEnv({ path: path.join(__dirname, "..", ".env.local"), override: true });

const required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
console.log("[test-push] Firebase Admin initialized:", admin.app().options.projectId);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const EMAIL = "stcha0004@gmail.com";
const USER_ID = "610a5745-1fac-429c-8f5a-8d085783a5ea"; // known from earlier DB query
const user = { id: USER_ID, email: EMAIL };
console.log("[test-push] Target:", EMAIL, user.id);

const platformFilter = process.env.PUSH_PLATFORM || null; // 'android' | 'ios' | 'web' | null (all)
let q = supabase
  .from("user_devices")
  .select("device_token, platform, updated_at")
  .eq("user_id", user.id)
  .order("updated_at", { ascending: false })
  .limit(3);
if (platformFilter) q = q.eq("platform", platformFilter);
const { data: devices, error: devErr } = await q;

if (devErr || !devices?.length) {
  console.error("[test-push] No devices found for", EMAIL, devErr?.message);
  process.exit(1);
}

console.log("[test-push] Top 3 devices (most recent first):");
devices.forEach((d, i) => console.log(`  [${i}] ${d.platform.padEnd(8)} ${d.device_token.slice(0, 30)}...  (${d.updated_at})`));

const nowIso = new Date().toISOString();
const messages = devices.map((d) => ({
  token: d.device_token,
  notification: {
    title: "Quiver end-to-end push test",
    body: `Firebase Admin → FCM → your device, ${nowIso}`,
  },
  data: {
    type: "test_push",
    sent_at: nowIso,
  },
}));

console.log("[test-push] Sending via messaging.sendEach...");
const response = await admin.messaging().sendEach(messages);

console.log(`[test-push] successCount=${response.successCount} failureCount=${response.failureCount}`);
response.responses.forEach((r, i) => {
  const d = devices[i];
  if (r.success) {
    console.log(`  [${i}] ✅ ${d.platform} ${d.device_token.slice(0, 20)}... -> messageId=${r.messageId}`);
  } else {
    console.log(`  [${i}] ❌ ${d.platform} ${d.device_token.slice(0, 20)}... -> ${r.error?.code}: ${r.error?.message}`);
  }
});

process.exit(response.successCount > 0 ? 0 : 1);
