#!/usr/bin/env node
// Phase 3 smoke: reproduce the native Android upsert_failed: 401 against prod.
//
// Why: mocks can't catch env-var misconfig, Supabase auth-service rejection of
// real JWTs, or Vercel infra stripping the Authorization header. This exercises
// the real /api/devices/upsert endpoint with a real Bearer token.
//
// Usage (two supported paths):
//
//   1) With a known test user's email/password:
//      TEST_USER_EMAIL=stcha0004@gmail.com \
//      TEST_USER_PASSWORD=... \
//      node scripts/prod-push-upsert-smoke.mjs
//
//   2) With an access_token already in hand (paste from device):
//      TEST_USER_ACCESS_TOKEN=eyJhbGciOi... \
//      node scripts/prod-push-upsert-smoke.mjs
//
// Outputs on non-200:
//   - Full response body
//   - Decoded JWT claims (iss, aud, exp, sub)
//   - Whether Authorization header was present on the request

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, "..", ".env") });
loadEnv({ path: path.join(__dirname, "..", ".env.local"), override: true });

const API_BASE = process.env.SMOKE_API_BASE || "https://www.quiversurf.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

function decodeJwtPayload(jwt) {
  try {
    const [, payload] = jwt.split(".");
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getAccessToken() {
  if (process.env.TEST_USER_ACCESS_TOKEN) {
    return process.env.TEST_USER_ACCESS_TOKEN.trim();
  }
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    console.error(
      "Need TEST_USER_ACCESS_TOKEN, OR TEST_USER_EMAIL + TEST_USER_PASSWORD. See file header."
    );
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    console.error("Sign-in failed:", error?.message ?? "no session");
    process.exit(1);
  }
  return data.session.access_token;
}

const accessToken = await getAccessToken();
const claims = decodeJwtPayload(accessToken);
console.log("[smoke] JWT claims:", {
  iss: claims?.iss,
  aud: claims?.aud,
  sub: claims?.sub,
  exp: claims?.exp ? new Date(claims.exp * 1000).toISOString() : null,
  role: claims?.role,
});
const expired = claims?.exp && claims.exp * 1000 < Date.now();
if (expired) console.warn("[smoke] WARNING: JWT is already expired");

const url = `${API_BASE}/api/devices/upsert`;
const body = JSON.stringify({
  platform: "android",
  device_token: `smoke-diagnostic-${Date.now()}`,
});
console.log(`[smoke] POST ${url}`);
const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body,
});
const text = await response.text();
let parsed = null;
try {
  parsed = JSON.parse(text);
} catch {
  // non-JSON body; keep raw text
}
console.log(`[smoke] status=${response.status}`);
console.log("[smoke] response-body:", parsed ?? text);

if (response.status === 200) {
  console.log("[smoke] ✅ SERVER ACCEPTS BEARER — prod auth pipeline works end-to-end.");
  console.log("[smoke]    If native still 401s, look at the device/session side:");
  console.log("[smoke]      - auth-provider.tsx session hydration timing");
  console.log("[smoke]      - Zustand session.access_token at fetch time");
  console.log("[smoke]      - Supabase client autoRefreshToken behavior after background resume");
  process.exit(0);
}

console.log("[smoke] ❌ SERVER REJECTED BEARER — this is the real bug.");
console.log("[smoke] Interpretation:");
if (parsed?.error === "Authentication required") {
  if (expired) {
    console.log("[smoke]   -> Token was expired. Get a fresh one and re-run.");
  } else {
    console.log("[smoke]   -> Token looked valid but server's supabase.auth.getUser rejected it.");
    console.log("[smoke]      Check Vercel env: NEXT_PUBLIC_SUPABASE_URL must match iss claim");
    console.log(`[smoke]      Claim iss: ${claims?.iss ?? "<unset>"}`);
    console.log("[smoke]      Also check that Vercel build is on the same Supabase project.");
  }
} else {
  console.log("[smoke]   -> Unexpected response shape. Route may not be what we think.");
}
process.exit(1);
