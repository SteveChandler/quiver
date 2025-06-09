import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Matches Ruby LocationsController#create functionality
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // TODO: Add admin authentication check
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const body = await request.json();
    const { id, name, latitude, longitude } = body;

    if (!name || !latitude || !longitude) {
      return NextResponse.json(
        { error: "Name, latitude, and longitude are required" },
        { status: 400 }
      );
    }

    let result;

    if (id) {
      // Update existing location
      result = await supabase
        .from("beaches")
        .update({
          name,
          latitude,
          longitude,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
    } else {
      // Create new location
      result = await supabase
        .from("beaches")
        .insert({
          name,
          latitude,
          longitude,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error("Database error:", result.error);
      return NextResponse.json(
        { error: "Failed to save location" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.data.id,
        name: result.data.name,
        latitude: result.data.latitude,
        longitude: result.data.longitude,
      },
    });
  } catch (error) {
    console.error("Error saving location:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
