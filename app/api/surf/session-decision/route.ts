import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { entitlementFromRow } from "@/lib/alerts/entitlements";
import {
  createSuccessResponse,
  type AuthenticatedContext,
  validateOrError,
  withAuth,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { resolveCanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DEFAULT_HORIZON_HOURS = 24;
const NO_STORE = "private, no-store, no-cache, must-revalidate";

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const QuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().max(100).optional(),
    horizonHours: z.coerce
      .number()
      .int()
      .min(1)
      .max(72)
      .default(DEFAULT_HORIZON_HOURS),
    timezone: z
      .string()
      .min(1)
      .refine(isValidTimezone, "Invalid IANA timezone"),
    timeSlot: z
      .enum(["any", "lunch-session", "afternoon", "dawn-patrol"])
      .default("any"),
    mode: z.enum(["best-window", "now"]).default("best-window"),
  })
  .superRefine((value, context) => {
    if ((value.lat === undefined) === (value.lon === undefined)) return;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.lat === undefined ? ["lat"] : ["lon"],
      message: "Both lat and lon must be provided",
    });
  });

async function sessionDecisionHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext,
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const validation = validateOrError(QuerySchema, {
    lat: searchParams.get("lat") ?? undefined,
    lon: searchParams.get("lon") ?? undefined,
    radius: searchParams.get("radius") ?? undefined,
    horizonHours: searchParams.get("horizonHours") ?? undefined,
    timezone: searchParams.get("timezone") ?? undefined,
    timeSlot: searchParams.get("timeSlot") ?? undefined,
    mode: searchParams.get("mode") ?? undefined,
  });
  if ("error" in validation) return validation.error;

  const { lat, lon, radius, horizonHours, timezone, timeSlot, mode } =
    validation.data;
  const anchor = new Date();
  const anchorTime = anchor.toISOString();
  const windowEnd = new Date(
    anchor.getTime() + horizonHours * 60 * 60 * 1000,
  ).toISOString();

  let profileExperience: unknown = null;
  try {
    profileExperience = await getProfileExperienceLevel(supabase, user.id);
  } catch {
    profileExperience = null;
  }

  const { data: entitlementRow } = await supabase
    .from("user_entitlements")
    .select("is_pro, is_trialing, billing_issue, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const isPro = entitlementFromRow(entitlementRow ?? null) === "premium";

  const decision = await resolveCanonicalSessionDecision({
    userId: user.id,
    profileExperience,
    anchorTime,
    scope: {
      kind: "plan_next_session",
      windowStart: anchorTime,
      windowEnd,
      timezone,
    },
    discoveryOptions: {
      userLocation:
        lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
      radiusMiles: radius,
      horizonHours,
      timeSlot,
      discoveryMode: mode,
      isPro,
    },
  });

  return createSuccessResponse(decision);
}

const protectedGET = withRateLimit(
  withAuth(sessionDecisionHandler, {
    errorMessage: "Error resolving session decision",
  }),
  "surf-discovery",
);

export const GET = async (
  ...args: Parameters<typeof protectedGET>
): Promise<NextResponse> => {
  const response = await protectedGET(...args);
  response.headers.delete("ETag");
  response.headers.set("Cache-Control", NO_STORE);
  return response;
};
