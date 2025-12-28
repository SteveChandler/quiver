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
    const cookieStore = cookies();

    // Create a Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name, options) {
            cookieStore.delete({ name, ...options });
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

    // First, find the beach by name or create a new beach entry
    let beachId = null;
    if (validatedData.beach_name) {
      // Look up the beach by name
      const { data: beach } = await supabase
        .from("beaches")
        .select("id")
        .ilike("name", validatedData.beach_name)
        .maybeSingle();

      if (beach) {
        beachId = beach.id;
      } else {
        // Create a new beach if not found
        const { data: newBeach, error: beachError } = await supabase
          .from("beaches")
          .insert({ name: validatedData.beach_name })
          .select()
          .single();

        if (beachError) {
          console.error("Error creating beach:", beachError);
        } else if (newBeach) {
          beachId = newBeach.id;
        }
      }
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
