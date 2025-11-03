/**
 * OpenGraph Image API Route
 * Generates 1200x630 PNG images for social media sharing (Twitter/Facebook)
 * GET /api/og/session/[sessionId]?variant=1
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { renderSessionCardImage } from "@/lib/satori/session-card-renderer";
import type { SessionWithDetails } from "@/types/database";
import type { ShareVariant } from "@/types/session-share";
import { isShareVariant } from "@/types/session-share";

/**
 * GET handler - Generate OG image
 * Returns 1200x630 PNG for optimal social media display
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    const searchParams = request.nextUrl.searchParams;

    // Parse variant parameter (default to 1)
    const variantParam = searchParams.get("variant") || "1";
    const variantNum = parseInt(variantParam);

    if (!isShareVariant(variantNum)) {
      return NextResponse.json(
        { error: "Invalid variant. Must be 1-6." },
        { status: 400 }
      );
    }
    const variant = variantNum as ShareVariant;

    // Fetch session from database
    const supabase = createServerClient();

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(
        `
        *,
        beaches (
          id,
          name,
          slug
        ),
        boards (
          id,
          name
        ),
        profiles (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check if session is public
    if (!session.is_public) {
      return NextResponse.json(
        { error: "Session is not public" },
        { status: 403 }
      );
    }

    const typedSession = session as SessionWithDetails;

    // Fetch session photos count
    const { data: photos } = await supabase
      .from("session_media")
      .select("id")
      .eq("session_id", sessionId);

    const photoCount = photos?.length || 0;

    // Generate image using Satori renderer
    // Use 16:9 aspect ratio (1200x630) for optimal OpenGraph display
    const { png } = await renderSessionCardImage(
      typedSession,
      variant,
      "16:9", // OpenGraph standard: 1200x630 landscape
      photoCount // Pass photo count for display
    );

    // Return PNG with proper headers
    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        // Cache for 1 hour (as per requirements)
        "Cache-Control": "public, max-age=3600, immutable",
        // Add Content-Disposition for better browser handling
        "Content-Disposition": `inline; filename="session-${sessionId}-og.png"`,
      },
    });
  } catch (error) {
    console.error("Error generating OG image:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
