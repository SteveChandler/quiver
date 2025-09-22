import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceRoleClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import {
  createSuccessResponse,
  createAuthError,
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    // Parse the JSON data from the request
    const sessionData = await request.json();

    // Create a session from the data (either as a single object or the first item in an array)
    const dataToUse = Array.isArray(sessionData) ? sessionData[0] : sessionData;

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

    // Validate required fields
    if (!dataToUse.beach_name || !dataToUse.session_date) {
      return createValidationError("Beach name and session date are required");
    }

    // Clean up data by removing undefined values
    const cleanData = Object.fromEntries(
      Object.entries(dataToUse).filter(
        ([_, v]) => v !== undefined && v !== "$undefined"
      )
    );

    // First, find the beach by name or create a new beach entry
    let beachId = null;
    if (cleanData.beach_name) {
      // Look up the beach by name
      const { data: beach } = await supabase
        .from("beaches")
        .select("id")
        .ilike("name", cleanData.beach_name)
        .maybeSingle();

      if (beach) {
        beachId = beach.id;
      } else {
        // Create a new beach if not found
        const { data: newBeach, error: beachError } = await supabase
          .from("beaches")
          .insert({ name: cleanData.beach_name })
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
    const { session_date, start_time } = cleanData;

    // Convert session_date and start_time to arrival_time timestamp
    const timeString = start_time || "00:00:00"; // Default to midnight if no time specified
    const arrivalTime = new Date(`${session_date}T${timeString}`);

    // Create the final session data object
    const sessionRecord = {
      user_id: user.id,
      profile_id: user.id, // Add profile_id to satisfy the constraint
      beach_id: beachId,
      beach_name: cleanData.beach_name,
      arrival_time: arrivalTime.toISOString(),
      status: "planned",
      notes: cleanData.notes,
      board_id: cleanData.board_id,
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
    return createSuccessResponse({ success: true, data: session }, 201);
  } catch (error) {
    console.error("Error in plan-session API:", error);
    return handleApiError(error, "Failed to create planned session");
  }
}
