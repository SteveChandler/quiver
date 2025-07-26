import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";
import { isAdmin } from "@/lib/auth/admin";

// GET method to retrieve all beaches
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("beaches")
      .select("*")
      .order("name");

    if (error) {
      console.error("Database error:", error);
      return handleApiError(error, "Failed to fetch beaches");
    }

    return createSuccessResponse({
      beaches: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching beaches:", error);
    return handleApiError(error, "Failed to fetch beaches");
  }
}

// Matches Ruby LocationsController#create functionality
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Admin authentication check - only admins can create/update beaches
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !isAdmin(session.user)) {
      return NextResponse.json({ 
        error: "Unauthorized - Admin access required" 
      }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, latitude, longitude } = body;

    if (!name || !latitude || !longitude) {
      return createValidationError(
        "Name, latitude, and longitude are required"
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
      return handleApiError(result.error, "Failed to save location");
    }

    return createSuccessResponse({
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
    return handleApiError(error, "Failed to save location");
  }
}
