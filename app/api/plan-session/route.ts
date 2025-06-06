import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
      return NextResponse.json(
        { success: false, error: "Authentication error" },
        { status: 401 }
      );
    }

    if (!user) {
      console.error("No user found in plan-session API");
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!dataToUse.beach_name || !dataToUse.session_date) {
      return NextResponse.json(
        { success: false, error: "Beach name and session date are required" },
        { status: 400 }
      );
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
      profile_id: user.id,
      beach_id: beachId,
      beach_name: cleanData.beach_name,
      arrival_time: arrivalTime.toISOString(),
      status: "planned",
      notes: cleanData.notes,
      board_id: cleanData.board_id,
    };

    // Create the session
    const { data: session, error } = await supabase
      .from("sessions")
      .insert(sessionRecord)
      .select()
      .single();

    if (error) {
      console.error("Error creating planned session:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Return the created session
    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    console.error("Error in plan-session API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
