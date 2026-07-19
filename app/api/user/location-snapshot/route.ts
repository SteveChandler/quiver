import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  createValidationError,
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { findTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";

export const dynamic = "force-dynamic";

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_LOCATION_AGE_MS = 15 * 60 * 1000;

const LocationSnapshotSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  capturedAt: z.string().datetime({ offset: true }),
  source: z.enum(["home", "explore", "week_scout", "permission_recovery"]),
});

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function privateNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function postLocationSnapshot(
  request: NextRequest,
  { user }: AuthenticatedContext
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateNoStore(createValidationError("Invalid JSON body"));
  }

  const parsed = LocationSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return privateNoStore(
      createValidationError(
        "Invalid location snapshot",
        parsed.error.flatten()
      )
    );
  }

  const capturedAtMs = Date.parse(parsed.data.capturedAt);
  const nowMs = Date.now();
  if (
    capturedAtMs > nowMs + MAX_FUTURE_SKEW_MS ||
    nowMs - capturedAtMs >= MAX_LOCATION_AGE_MS
  ) {
    return privateNoStore(
      createValidationError("Location snapshot is not current")
    );
  }

  const timezone = findTimezoneFromCoords(parsed.data.lat, parsed.data.lon);
  if (!timezone) {
    return privateNoStore(
      createValidationError("Could not resolve location timezone")
    );
  }

  const capturedAt = new Date(capturedAtMs).toISOString();
  const now = new Date(nowMs).toISOString();
  const serviceRole = createSupabaseServiceRoleClient();
  const { error } = await (serviceRole as any).from("user_location_snapshots").upsert(
    {
      user_id: user.id,
      lat: roundCoordinate(parsed.data.lat),
      lon: roundCoordinate(parsed.data.lon),
      timezone,
      captured_at: capturedAt,
      source: parsed.data.source,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[location-snapshot] Failed to store current location", error.message);
    return privateNoStore(
      createErrorResponse("Failed to store location snapshot", undefined, 500)
    );
  }

  return privateNoStore(createSuccessResponse({ capturedAt, timezone }));
}

async function deleteLocationSnapshot(
  _request: NextRequest,
  { user, supabase }: AuthenticatedContext
): Promise<NextResponse> {
  const { error } = await (supabase as any)
    .from("user_location_snapshots")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("[location-snapshot] Failed to delete current location", error.message);
    return privateNoStore(
      createErrorResponse("Failed to delete location snapshot", undefined, 500)
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export const POST = withAuth(postLocationSnapshot, {
  errorMessage: "Failed to store location snapshot",
});

export const DELETE = withAuth(deleteLocationSnapshot, {
  errorMessage: "Failed to delete location snapshot",
});
