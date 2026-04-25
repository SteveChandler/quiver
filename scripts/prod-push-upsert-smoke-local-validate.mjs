#!/usr/bin/env node
// Follow-up diagnostic: takes the SAME access token flow as the prod server
// and calls it from this machine. If Supabase accepts the JWT here but Vercel
// rejects it, the bug is on Vercel (env/config). If both reject, the bug is
// somewhere in lib/supabase/bearer-client.ts or lib/middleware/api-wrappers/
// auth-wrapper.ts.

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, "..", ".env") });
loadEnv({ path: path.join(__dirname, "..", ".env.local"), override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
console.log("[local-validate] NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL);
console.log("[local-validate] NEXT_PUBLIC_SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY?.slice(0, 40) + "...");

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await authClient.auth.signInWithPassword({
  email: process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD,
});
if (error || !data.session?.access_token) {
  console.error("[local-validate] sign-in failed:", error?.message);
  process.exit(1);
}
const jwt = data.session.access_token;
console.log("[local-validate] obtained JWT, len=", jwt.length);

// Exact replica of createBearerTokenClient
const bearerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${jwt}` } },
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: userData, error: userErr } = await bearerClient.auth.getUser(jwt);
if (userErr) {
  console.error("[local-validate] ❌ Supabase rejected the JWT:", userErr.name, "-", userErr.message);
  console.error("[local-validate]    → server code bug OR Supabase auth issue.");
  process.exit(1);
}
if (!userData.user) {
  console.error("[local-validate] ❌ no user in response but no error either.");
  process.exit(1);
}
console.log("[local-validate] ✅ Supabase accepted the JWT.");
console.log("[local-validate]    user.id:", userData.user.id);
console.log("[local-validate]    user.email:", userData.user.email);
console.log("[local-validate] ");
console.log("[local-validate] Conclusion: the server-side code path works when given this env.");
console.log("[local-validate] The bug is in VERCEL PRODUCTION ENV, not the code.");
console.log("[local-validate] Check: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel prod.");
process.exit(0);
