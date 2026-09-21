import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  createValidationError,
  withAuth,
  withNoStore,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { normalizeIanaTimezone } from "@/lib/utils/iana-timezone";

export const dynamic = "force-dynamic";

const TimezoneSchema = z.object({
  timezone: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length >= 1 && value.length <= 100)
    .refine((value) => normalizeIanaTimezone(value) !== null),
});

function privateNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function postTimezone(
  request: NextRequest,
  { user }: AuthenticatedContext,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateNoStore(createValidationError("Invalid JSON body"));
  }

  const parsed = TimezoneSchema.safeParse(body);
  if (!parsed.success) {
    return privateNoStore(createValidationError("Invalid timezone"));
  }

  const timezone = normalizeIanaTimezone(parsed.data.timezone)!;
  const serviceRole = createSupabaseServiceRoleClient();
  const { data, error } = await serviceRole
    .from("profiles")
    .update({ timezone })
    .eq("id", user.id)
    .is("timezone", null)
    .select("id");

  if (error) {
    console.error("[user-timezone] Failed to record browser timezone", error.message);
    return privateNoStore(
      createErrorResponse("Failed to record browser timezone", undefined, 500),
    );
  }

  return privateNoStore(
    createSuccessResponse({ updated: Array.isArray(data) && data.length > 0 }),
  );
}

export const POST = withNoStore(
  withRateLimit(
    withAuth(postTimezone, { errorMessage: "Failed to record browser timezone" }),
    "authenticated-default",
  ),
);
