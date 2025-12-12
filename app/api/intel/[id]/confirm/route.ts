import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * Intel Post Confirmation API
 *
 * POST /api/intel/[id]/confirm - Confirm an intel post
 * DELETE /api/intel/[id]/confirm - Remove confirmation from an intel post
 */

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/intel/[id]/confirm
 * Adds a user confirmation to an intel post
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: intelPostId } = params;

    if (!intelPostId) {
      return NextResponse.json(
        { error: "Intel post ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Check authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if intel post exists and is active
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id, user_id, is_active, expires_at")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return NextResponse.json(
        { error: "Intel post not found" },
        { status: 404 }
      );
    }

    if (!intelPost.is_active) {
      return NextResponse.json(
        { error: "Intel post is no longer active" },
        { status: 400 }
      );
    }

    // Check if post has expired
    if (intelPost.expires_at && new Date(intelPost.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Intel post has expired" },
        { status: 400 }
      );
    }

    // Prevent users from confirming their own posts
    if (intelPost.user_id === user.id) {
      return NextResponse.json(
        { error: "You cannot confirm your own intel post" },
        { status: 400 }
      );
    }

    // Check if user has already confirmed this post
    const { data: existingConfirmation, error: checkError } = await supabase
      .from("intel_post_confirmations")
      .select("id")
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows found
      console.error("Error checking existing confirmation:", checkError);
      return handleApiError(checkError, "Failed to check confirmation status");
    }

    if (existingConfirmation) {
      return NextResponse.json(
        { error: "You have already confirmed this intel post" },
        { status: 400 }
      );
    }

    // Create confirmation
    const { data: confirmation, error: confirmError } = await supabase
      .from("intel_post_confirmations")
      .insert({
        intel_post_id: intelPostId,
        user_id: user.id,
      })
      .select()
      .single();

    if (confirmError) {
      console.error("Error creating confirmation:", confirmError);
      return handleApiError(confirmError, "Failed to confirm intel post");
    }

    // Get updated confirmations count
    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

    if (updateError) {
      console.error("Error fetching updated count:", updateError);
      // Don't fail the request, just return the confirmation
    }

    return createSuccessResponse(
      {
        confirmed: true,
        confirmations_count: updatedPost?.confirmations_count || 0,
        confirmation_id: confirmation.id,
      }
    );
  } catch (error) {
    console.error("Intel confirmation POST error:", error);
    return handleApiError(error, "Failed to confirm intel post");
  }
}

/**
 * DELETE /api/intel/[id]/confirm
 * Removes a user confirmation from an intel post
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: intelPostId } = params;

    if (!intelPostId) {
      return NextResponse.json(
        { error: "Intel post ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Check authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if intel post exists
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return NextResponse.json(
        { error: "Intel post not found" },
        { status: 404 }
      );
    }

    // Find and delete the user's confirmation
    const { data: deletedConfirmation, error: deleteError } = await supabase
      .from("intel_post_confirmations")
      .delete()
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (deleteError) {
      if (deleteError.code === "PGRST116") {
        // No rows found
        return NextResponse.json(
          { error: "You have not confirmed this intel post" },
          { status: 400 }
        );
      }
      console.error("Error deleting confirmation:", deleteError);
      return handleApiError(deleteError, "Failed to remove confirmation");
    }

    // Get updated confirmations count
    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

    if (updateError) {
      console.error("Error fetching updated count:", updateError);
      // Don't fail the request, just return the confirmation
    }

    return createSuccessResponse(
      {
        confirmed: false,
        confirmations_count: updatedPost?.confirmations_count || 0,
        confirmation_id: deletedConfirmation.id,
      }
    );
  } catch (error) {
    console.error("Intel confirmation DELETE error:", error);
    return handleApiError(error, "Failed to remove intel post confirmation");
  }
}
