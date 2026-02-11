import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceRoleClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import {
  createSuccessResponse,
  createAuthError,
  createValidationError,
  handleApiError,
  validateOrError,
} from "@/lib/api-utils";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { SessionPlanSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  try {
    // Validate Content-Type and parse JSON
    const parseResult = await parseAndValidateJson(request);
    if ('error' in parseResult) {
      return parseResult.error;
    }

    // Handle both single object and array formats
    const sessionData = parseResult.data;
    const dataToUse = Array.isArray(sessionData) ? sessionData[0] : sessionData;

    // Validate against schema
    const validationResult = validateOrError(SessionPlanSchema, dataToUse);
    if ('error' in validationResult) {
      return validationResult.error;
    }

    const validatedData = validationResult.data;

    // Get the cookie store from Next.js
    const cookieStore = await cookies();

    // Create a Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Auth error in plan-session API:", userError);
      return createAuthError("Authentication error");
    }

    if (!user) {
      console.error("No user found in plan-session API");
      return createAuthError("Authentication required");
    }

    // Data is already validated by schema - no manual checks needed

    // Resolve existing beach (do not create new beaches here; RLS restricts inserts)
    let beachId: string | null = null;

    if (validatedData.beach_id) {
      const { data: beach, error: beachLookupError } = await supabase
        .from("beaches")
        .select("id")
        .eq("id", validatedData.beach_id)
        .maybeSingle();

      if (beachLookupError) {
        return handleApiError(beachLookupError, "Failed to validate beach");
      }

      if (!beach) {
        return createValidationError("Beach not found — please select an existing beach", {
          beach_id: validatedData.beach_id,
        });
      }

      beachId = beach.id;
    } else if (validatedData.beach_name) {
      const beachName = validatedData.beach_name.trim();
      const { data: beach, error: beachLookupError } = await supabase
        .from("beaches")
        .select("id")
        .ilike("name", beachName)
        .maybeSingle();

      if (beachLookupError) {
        return handleApiError(beachLookupError, "Failed to resolve beach");
      }

      if (!beach) {
        return createValidationError("Beach not found — please select an existing beach", {
          beach_name: beachName,
        });
      }

      beachId = beach.id;
    } else {
      // Should be unreachable due to schema refinement, but keep a defensive check
      return createValidationError("Beach is required");
    }

    // Create a session record with the proper fields
    const { session_date, start_time } = validatedData;

    // Convert session_date and start_time to arrival_time timestamp
    const timeString = start_time || "00:00:00"; // Default to midnight if no time specified
    const arrivalTime = new Date(`${session_date}T${timeString}`);

    // Create the final session data object
    const sessionRecord = {
      user_id: user.id,
      profile_id: user.id, // Add profile_id to satisfy the constraint
      beach_id: beachId,
      beach_name: validatedData.beach_name,
      arrival_time: arrivalTime.toISOString(),
      status: "planned",
      notes: validatedData.notes,
      board_id: validatedData.board_id,
    };

    // Create the session
    // Dev-only bypass for mock users
    let writeClient = supabase as any;
    try {
      if (
        (process.env.ALLOW_E2E_MUTATIONS_DEV === "1" ||
          (process.env.ALLOW_E2E_MUTATIONS_DEV || "").toLowerCase() === "true")
      ) {
        const { data: me } = await supabase
          .from("profiles")
          .select("is_mock")
          .eq("id", user.id)
          .single();
        if (me?.is_mock === true) {
          writeClient = createServiceRoleClient();
        }
      }
    } catch {}

    const { data: session, error } = await writeClient
      .from("sessions")
      .insert(sessionRecord)
      .select()
      .single();

    if (error) {
      console.error("Error creating planned session:", error);
      return handleApiError(error, "Failed to create planned session");
    }

    // Return the created session
    return createSuccessResponse(session, 201);
  } catch (error) {
    console.error("Error in plan-session API:", error);
    return handleApiError(error, "Failed to create planned session");
  }
}
