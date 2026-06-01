import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createValidationError,
  methodNotAllowed,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";
import { addFeaturedPhotoToSessions } from "@/actions/session-actions";

function parseLimit(url: URL, defaultValue = 5, max = 20) {
  const raw = url.searchParams.get("limit");
  const n = raw ? Number(raw) : defaultValue;
  if (Number.isNaN(n) || n < 1) return defaultValue;
  return Math.min(n, max);
}

function isUuidLike(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export const dynamic = "force-dynamic";

/**
 * GET /api/users/[id]/sessions
 *
 * Uses `withAuth({ optional: true })` so both cookie (web) and Bearer
 * (native) auth resolve the caller — and unauthenticated callers still
 * see public sessions of other users. The prior cookie-only handler
 * treated every native caller as "not own", silently capping the limit
 * at 20 for the user's own profile too.
 */
async function handler(
  request: NextRequest,
  { user, supabase, params }: OptionalAuthContext,
) {
  const targetUserId = params.id;

  if (!targetUserId || !isUuidLike(targetUserId)) {
    return createValidationError("Invalid or missing user ID");
  }

  const url = new URL(request.url);
  const isOwn = user?.id === targetUserId;
  // Allow a larger limit for the authenticated user's own profile; keep
  // other-user lookups small to reduce load.
  const limit = parseLimit(url, 5, isOwn ? 200 : 20);

  // Block filter: caller has blocked the target → return empty list. Don't
  // 404 because some web consumers expect the array shape; an empty list
  // matches "this user has no public sessions" semantics.
  if (user && !isOwn) {
    const { data: block, error: blockErr } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId)
      .maybeSingle();
    if (blockErr) throw blockErr;
    if (block) {
      return createSuccessResponse({ sessions: [] });
    }
  }

  let query = supabase
    .from("sessions")
    .select(
      `
      *,
      beach:beaches(id, name, lat, lon),
      user:profiles(id, full_name, avatar_url)
    `,
    )
    .eq("user_id", targetUserId)
    .order("arrival_time", { ascending: false })
    .limit(limit);

  if (!isOwn) {
    query = query.eq("is_public", true);
  }

  const { data, error } = await query;

  // Fallback: if joins fail, fetch basics and manually resolve relationships.
  if (error) {
    console.error(
      "Session query with joins failed, falling back to basic query:",
      error,
    );

    let basicQuery = supabase
      .from("sessions")
      .select("*")
      .eq("user_id", targetUserId)
      .order("arrival_time", { ascending: false })
      .limit(limit);

    if (!isOwn) {
      basicQuery = basicQuery.eq("is_public", true);
    }

    const { data: basicData, error: basicError } = await basicQuery;
    if (basicError) throw basicError;

    const enhancedSessions = await Promise.all(
      (basicData || []).map(async (session) => {
        let beach = null;
        let userData: { full_name: string | null; avatar_url: string | null } = {
          full_name: "Anonymous Surfer",
          avatar_url: null,
        };

        if (session.beach_id) {
          try {
            const { data: beachData } = await supabase
              .from("beaches")
              .select("id, name, lat, lon")
              .eq("id", session.beach_id)
              .single();
            beach = beachData;
          } catch (beachError) {
            console.warn(`Failed to fetch beach ${session.beach_id}:`, beachError);
          }
        }

        if (session.user_id) {
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .eq("id", session.user_id)
              .single();
            if (profileData) {
              userData = {
                full_name: profileData.full_name ?? null,
                avatar_url: profileData.avatar_url ?? null,
              };
            }
          } catch (userError) {
            console.warn(`Failed to fetch user profile ${session.user_id}:`, userError);
          }
        }

        return {
          ...session,
          beach,
          user: userData,
        };
      }),
    );

    const sessionsWithPhotos = await addFeaturedPhotoToSessions(
      supabase,
      enhancedSessions,
    );

    return createSuccessResponse({ sessions: sessionsWithPhotos });
  }

  const sessionsWithPhotos = await addFeaturedPhotoToSessions(
    supabase,
    data || [],
  );

  return createSuccessResponse({ sessions: sessionsWithPhotos });
}

export const GET = withAuth(handler, {
  optional: true,
  errorMessage: "Failed to load user sessions",
});

export function POST() {
  return methodNotAllowed(["GET"]);
}
