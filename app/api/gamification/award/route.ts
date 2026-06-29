import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  createValidationError,
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  fetchUserXPStatus,
  getCurrentXP,
  getXPForAction,
  incrementUserXP,
  initializeUserXP,
} from "@/lib/gamification/xp-service";
import { calculateLevel } from "@/lib/gamification/level-service";
import { evaluateBadgeUnlocks } from "@/lib/gamification/badge-service";
import { invalidateUserCaches } from "@/lib/gamification/cache";

export const dynamic = "force-dynamic";

const AwardRequestSchema = z.object({
  action: z.literal("log_session"),
  related_entity_id: z.string().uuid(),
  related_entity_type: z.literal("session"),
});

type AwardRequest = z.infer<typeof AwardRequestSchema>;

async function verifyRelatedEntityOwnership(
  { related_entity_id }: AwardRequest,
  { user, supabase }: Pick<AuthenticatedContext, "user" | "supabase">,
): Promise<NextResponse | null> {
  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", related_entity_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!sessionRow) {
    return createErrorResponse("Session not found", undefined, 404);
  }
  return null;
}

async function awardHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext,
): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return createValidationError("Invalid payload", {
      body: "Body must be valid JSON",
    });
  }

  const validation = AwardRequestSchema.safeParse(rawBody);
  if (!validation.success) {
    return createValidationError(
      "Invalid payload",
      validation.error.flatten(),
    );
  }

  const { action, related_entity_id } = validation.data;

  const ownershipError = await verifyRelatedEntityOwnership(validation.data, {
    user,
    supabase,
  });
  if (ownershipError) return ownershipError;

  const { data: existingEvent, error: existingError } = await supabase
    .from("xp_events")
    .select("id")
    .eq("user_id", user.id)
    .eq("action", action)
    .eq("related_entity_id", related_entity_id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingEvent) {
    const xp = await fetchUserXPStatus(user.id, supabase);
    return createSuccessResponse({
      awarded: false,
      reason: "already_awarded",
      xp,
    });
  }

  const xpGained = getXPForAction(action);
  await initializeUserXP(user.id, supabase);
  const { level: previousLevel } = await getCurrentXP(user.id, supabase);
  const idempotencyKey = `${action}:${related_entity_id}`;
  const xpResult = await incrementUserXP(
    user.id,
    xpGained,
    action,
    related_entity_id,
    idempotencyKey,
    supabase,
  );

  if (xpResult.awarded === 0) {
    const xp = await fetchUserXPStatus(user.id, supabase);
    return createSuccessResponse({
      awarded: false,
      reason: "already_awarded",
      xp,
    });
  }

  const newTotalXP = xpResult.xp_total;
  const newLevel = xpResult.level;
  const { title: levelTitle } = calculateLevel(newTotalXP);
  const levelUp = newLevel > previousLevel;

  const newBadges = await evaluateBadgeUnlocks(user.id, supabase);
  invalidateUserCaches(user.id);

  return createSuccessResponse({
    awarded: true,
    result: {
      xp_gained: xpResult.awarded,
      total_xp: newTotalXP,
      previous_level: previousLevel,
      new_level: newLevel,
      level_up: levelUp,
      level_title: levelTitle,
      new_badges: newBadges,
    },
  });
}

export const POST = withAuth(awardHandler, {
  errorMessage: "Failed to award XP",
});
