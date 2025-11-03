/**
 * Share Image API Route
 * Generates PNG images for session cards with specified variant and aspect ratio
 * GET /api/sessions/[id]/share-image?variant=1&ratio=1:1
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthenticatedAPIClient } from "@/lib/supabase/api-server-client";
import { renderSessionCardImage } from "@/lib/satori/session-card-renderer";
import type { SessionWithDetails } from "@/types/database";
import type { ShareVariant, AspectRatio } from "@/types/session-share";
import { isShareVariant, isAspectRatio } from "@/types/session-share";

/**
 * GET handler - Generate share image
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Declare at function scope for error logging access
  let variant: ShareVariant | undefined;
  let aspectRatio: AspectRatio | undefined;

  try {
    // Require authentication for image generation
    const { supabase, user, error: authError } = await getAuthenticatedAPIClient();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required to generate share images" },
        { status: 401 }
      );
    }

    const sessionId = params.id;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const variantParam = searchParams.get("variant") || "1";
    const ratioParam = searchParams.get("ratio") || "1:1";

    // Validate variant
    const variantNum = parseInt(variantParam);
    if (!isShareVariant(variantNum)) {
      return NextResponse.json(
        { error: "Invalid variant. Must be 1-6." },
        { status: 400 }
      );
    }
    variant = variantNum as ShareVariant;

    // Validate aspect ratio
    if (!isAspectRatio(ratioParam)) {
      return NextResponse.json(
        { error: "Invalid aspect ratio. Must be 1:1, 4:5, or 9:16." },
        { status: 400 }
      );
    }
    aspectRatio = ratioParam as AspectRatio;

    // Rate limiting: Check recent share image requests from this user
    // Allow 10 requests per minute, 100 requests per hour
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count: recentMinuteCount, error: minuteCountError } = await supabase
      .from('session_shares')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneMinuteAgo);

    if (minuteCountError) {
      console.error("Rate limit check failed (minute):", minuteCountError);
      // Continue anyway - don't block on rate limit check failure
    } else if (recentMinuteCount && recentMinuteCount >= 10) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 10 images per minute. Please try again shortly." },
        { status: 429 }
      );
    }

    const { count: recentHourCount, error: hourCountError } = await supabase
      .from('session_shares')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if (hourCountError) {
      console.error("Rate limit check failed (hour):", hourCountError);
      // Continue anyway - don't block on rate limit check failure
    } else if (recentHourCount && recentHourCount >= 100) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 100 images per hour. Please try again later." },
        { status: 429 }
      );
    }

    // Fetch session from database

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

    // Check if session is public or user owns it
    const isOwner = session.user_id === user.id;
    if (!session.is_public && !isOwner) {
      return NextResponse.json(
        { error: "You don't have access to this session" },
        { status: 403 }
      );
    }

    // Generate image
    const image = await renderSessionCardImage(
      session as SessionWithDetails,
      variant,
      aspectRatio
    );

    // Return PNG with appropriate headers
    return new NextResponse(image.png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=604800, immutable", // 7 days
        "Content-Length": String(image.png.length),
      },
    });
  } catch (error) {
    console.error("Failed to generate share image:", error);

    // Capture error in Sentry with context
    Sentry.captureException(error, {
      tags: {
        feature: "social-share",
        variant: variant ? String(variant) : "unknown",
        aspectRatio: aspectRatio || "unknown",
        sessionId: params.id,
      },
      contexts: {
        session: {
          id: params.id,
          variant: variant || "unknown",
          aspectRatio: aspectRatio || "unknown",
        },
      },
      level: "error",
    });

    return NextResponse.json(
      {
        error: "Failed to generate image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler - CORS support
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
