// Delete Account Edge Function
//
// Soft-deletes the calling user's account. Invoked from the Quiver Native
// app's Edit Profile screen via `supabase.functions.invoke('delete-account')`.
//
// Auth model:
//   - The native client sends its user JWT in the Authorization header
//     (set automatically by supabase-js).
//   - We verify the JWT against the auth API to extract the user id, so a
//     malicious client can't pass an arbitrary user_id.
//   - The actual deletion runs through `delete_user_account(user_id)` (a
//     SECURITY DEFINER plpgsql function added in
//     20260407030000_add_account_deletion.sql) using the service role
//     client. The function is locked to service_role only.
//   - Finally we banish the auth user via `admin.updateUserById` with a
//     876,000-hour ban (~100 years), which revokes all refresh tokens and
//     prevents any future sign-in. We deliberately do NOT call
//     `admin.deleteUser` because that cascades through every public.* FK
//     and would defeat the soft-delete semantics.
//
// Apple App Store Guideline 5.1.1(v) requires accounts created in-app to
// be deletable from within the same app — this is the production fulfillment
// of that requirement.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface DeleteResult {
  audit_id: string;
  sessions_soft_deleted: number;
  comments_anonymized: number;
  personal_rows_deleted: number;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("[delete-account] Missing required env vars", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      hasAnonKey: !!anonKey,
    });
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  // ---------------------------------------------------------------------------
  // 1. Verify the caller's JWT and extract their user id
  // ---------------------------------------------------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Missing or malformed Authorization header" }, 401);
  }

  // Use a non-service client just for getUser() — passing the user JWT here
  // means Supabase Auth verifies the token cryptographically against the
  // configured JWT secret instead of trusting whatever the client claims.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    console.warn("[delete-account] JWT verification failed", { error: userError?.message });
    return jsonResponse({ error: "Invalid session" }, 401);
  }

  const userId = userData.user.id;
  console.log("[delete-account] Authenticated user", { userId });

  // ---------------------------------------------------------------------------
  // 2. Run the atomic deletion via SECURITY DEFINER RPC (service role only)
  // ---------------------------------------------------------------------------
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rpcResult, error: rpcError } = await adminClient.rpc(
    "delete_user_account",
    { p_user_id: userId },
  );

  if (rpcError) {
    console.error("[delete-account] RPC failed", {
      userId,
      message: rpcError.message,
      code: rpcError.code,
    });
    return jsonResponse(
      { error: "Failed to delete account data. Please try again." },
      500,
    );
  }

  const result = rpcResult as DeleteResult;
  console.log("[delete-account] Data deletion complete", { userId, result });

  // ---------------------------------------------------------------------------
  // 3. Banish the auth user — revokes all sessions, blocks future sign-in.
  //    We use a far-future ban duration instead of admin.deleteUser() because
  //    deleting auth.users would CASCADE through every FK referencing it and
  //    undo the soft-delete we just did.
  // ---------------------------------------------------------------------------
  // 876,000 hours = 100 years.
  const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });

  if (banError) {
    console.error("[delete-account] Ban failed but data was deleted", {
      userId,
      auditId: result.audit_id,
      message: banError.message,
    });
    // Still return success — the user's data is gone. The ban can be retried
    // out of band; the user already can't see anything because their profile
    // is scrubbed and their sessions are soft-deleted.
    return jsonResponse({
      success: true,
      warning: "Account data deleted but session revocation may have failed. Please sign out manually.",
      ...result,
    });
  }

  console.log("[delete-account] Auth user banned", { userId });

  return jsonResponse({ success: true, ...result });
});
