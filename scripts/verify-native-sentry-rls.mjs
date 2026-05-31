#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, "..", ".env") });
loadEnv({ path: path.join(__dirname, "..", ".env.local"), override: true });

const PROD_PROJECT_REF = "vawdnbbgawichorsjiwe";
const PROD_APPROVAL_TOKEN = "YES_I_HAVE_PRODUCTION_APPROVAL";
const STORAGE_BUCKET = "session-media";
const PROBE_SOURCE = "verify-native-sentry-rls";
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function fail(message) {
  console.error(`[native-rls-probe] ${message}`);
  process.exit(1);
}

function requiredEnv(name, fallbackName = null) {
  const value = process.env[name]?.trim() || (fallbackName ? process.env[fallbackName]?.trim() : "");
  if (!value) fail(`Missing ${name}${fallbackName ? ` or ${fallbackName}` : ""}`);
  return value;
}

function assertTargetSafety(supabaseUrl) {
  const target = process.env.CONFIRM_TARGET?.trim().toUpperCase();
  if (!target) {
    fail("Set CONFIRM_TARGET=LOCAL, DEV, BRANCH, STAGING, or PROD before running.");
  }

  const allowedTargets = new Set(["LOCAL", "DEV", "BRANCH", "STAGING", "PROD"]);
  if (!allowedTargets.has(target)) {
    fail(`Unsupported CONFIRM_TARGET=${target}`);
  }

  const isProdProject = supabaseUrl.includes(PROD_PROJECT_REF);
  const hasProdApproval = process.env.CONFIRM_PROD_RLS_PROBE === PROD_APPROVAL_TOKEN;

  if (target === "PROD" || isProdProject) {
    if (target !== "PROD") {
      fail(`Supabase URL points at production project ${PROD_PROJECT_REF}; rerun with CONFIRM_TARGET=PROD only after approval.`);
    }
    if (!hasProdApproval) {
      fail(
        `Production probe requires CONFIRM_PROD_RLS_PROBE=${PROD_APPROVAL_TOKEN}. Do not set this without explicit approval.`,
      );
    }
  }
}

function formatError(error) {
  if (!error) return "unknown error";
  return [
    error.message,
    error.code ? `code=${error.code}` : null,
    error.status ? `status=${error.status}` : null,
    error.statusCode ? `statusCode=${error.statusCode}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

async function expectNoError(label, request) {
  const result = await request;
  if (result.error) {
    throw new Error(`${label} failed: ${formatError(result.error)}`);
  }
  console.log(`[native-rls-probe] ok: ${label}`);
  return result.data;
}

async function cleanupStep(label, request) {
  try {
    const result = await request;
    if (result.error) {
      console.warn(`[native-rls-probe] cleanup warning: ${label}: ${formatError(result.error)}`);
    }
  } catch (error) {
    console.warn(
      `[native-rls-probe] cleanup warning: ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function main() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredEnv("RLS_PROBE_EMAIL", "TEST_USER_EMAIL");
  const password = requiredEnv("RLS_PROBE_PASSWORD", "TEST_USER_PASSWORD");

  assertTargetSafety(supabaseUrl);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.user || !signInData.session?.access_token) {
    fail(`signInWithPassword failed: ${formatError(signInError)}`);
  }

  const user = signInData.user;
  const accessToken = signInData.session.access_token;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const profile = await expectNoError(
    "load probe profile",
    serviceClient
      .from("profiles")
      .select("id, allow_implicit_tracking")
      .eq("id", user.id)
      .maybeSingle(),
  );

  if (!profile) fail(`Probe user ${user.id} has no profile row; sessions.user_id requires one.`);
  if (profile.allow_implicit_tracking === false) {
    fail(`Probe user ${user.id} has allow_implicit_tracking=false; analytics insert should fail by design.`);
  }

  const beachQuery = serviceClient.from("beaches").select("id, name").limit(1).maybeSingle();
  const beach = process.env.RLS_PROBE_BEACH_ID
    ? await expectNoError(
        "load requested probe beach",
        serviceClient
          .from("beaches")
          .select("id, name")
          .eq("id", process.env.RLS_PROBE_BEACH_ID.trim())
          .maybeSingle(),
      )
    : await expectNoError("load first probe beach", beachQuery);

  if (!beach) fail("No beach row available. Set RLS_PROBE_BEACH_ID to a valid beach id.");

  const probeId = randomUUID();
  const sessionId = randomUUID();
  const storagePath = `${sessionId}/${user.id}/01.png`;
  let insertedSession = false;

  console.log("[native-rls-probe] probe:", {
    probeId,
    userId: user.id,
    beachId: beach.id,
    storagePath,
  });

  try {
    await expectNoError(
      "authenticated sessions insert",
      userClient.from("sessions").insert({
        id: sessionId,
        user_id: user.id,
        beach_id: beach.id,
        beach_name: beach.name,
        arrival_time: new Date().toISOString(),
        duration_minutes: 45,
        goals: [],
        invitee_ids: [],
        is_public: false,
        source: "manual",
        status: "completed",
        image_url: null,
        notes: `RLS probe ${probeId}`,
      }),
    );
    insertedSession = true;

    await expectNoError(
      "authenticated session-media storage upload",
      userClient.storage.from(STORAGE_BUCKET).upload(storagePath, pngBytes, {
        cacheControl: "3600",
        contentType: "image/png",
        upsert: true,
      }),
    );

    await expectNoError(
      "authenticated session-media storage upsert",
      userClient.storage.from(STORAGE_BUCKET).upload(storagePath, pngBytes, {
        cacheControl: "3600",
        contentType: "image/png",
        upsert: true,
      }),
    );

    const { data: urlData } = userClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    await expectNoError(
      "authenticated session_media insert",
      userClient.from("session_media").insert({
        session_id: sessionId,
        user_id: user.id,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size: pngBytes.byteLength,
        media_type: "photo",
        metadata: {
          source: PROBE_SOURCE,
          rls_probe_id: probeId,
          order: 1,
        },
      }),
    );

    await expectNoError(
      "authenticated sessions hero photo update",
      userClient.from("sessions").update({ image_url: publicUrl }).eq("id", sessionId).eq("user_id", user.id),
    );

    await expectNoError(
      "authenticated user_events insert",
      userClient.from("user_events").insert({
        user_id: user.id,
        session_id: sessionId,
        beach_id: beach.id,
        event_type: "session_photo_upload_succeeded",
        metadata: {
          source: PROBE_SOURCE,
          rls_probe_id: probeId,
          storage_path: storagePath,
        },
      }),
    );

    console.log("[native-rls-probe] success: native authenticated photo/session/analytics RLS path works.");
  } finally {
    console.log("[native-rls-probe] cleanup starting");
    await cleanupStep("delete user_events", serviceClient.from("user_events").delete().eq("session_id", sessionId));
    await cleanupStep("delete session_media", serviceClient.from("session_media").delete().eq("session_id", sessionId));
    await cleanupStep("remove storage object", serviceClient.storage.from(STORAGE_BUCKET).remove([storagePath]));
    if (insertedSession) {
      await cleanupStep("delete sessions", serviceClient.from("sessions").delete().eq("id", sessionId));
    }
    console.log("[native-rls-probe] cleanup complete");
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
