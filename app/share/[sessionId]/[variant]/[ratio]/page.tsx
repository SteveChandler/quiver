/**
 * Share Card Preview Page
 * Displays session card preview for download
 * Route: /share/[sessionId]/[variant]/[ratio]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import type { SessionWithDetails } from "@/types/database";
import type { ShareVariant, AspectRatio } from "@/types/session-share";
import { isShareVariant, isAspectRatio, VARIANT_NAMES } from "@/types/session-share";
import SharePreview from "./SharePreview";

interface PageProps {
  params: {
    sessionId: string;
    variant: string;
    ratio: string;
  };
}

/**
 * Generate metadata for the page
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const variantNum = parseInt(params.variant);
  const variant = isShareVariant(variantNum) ? (variantNum as ShareVariant) : 1;
  const variantName = VARIANT_NAMES[variant];

  return {
    title: `Session Card Preview - ${variantName}`,
    description: `Preview and download your surf session card in ${variantName} style`,
    robots: "noindex, nofollow", // Don't index preview pages
  };
}

/**
 * Share Card Preview Page Component
 */
export default async function ShareCardPreviewPage({ params }: PageProps) {
  const { sessionId, variant: variantParam, ratio: ratioParam } = params;

  // Validate and parse variant
  const variantNum = parseInt(variantParam);
  if (!isShareVariant(variantNum)) {
    notFound();
  }
  const variant = variantNum as ShareVariant;

  // Validate and parse aspect ratio
  const decodedRatio = decodeURIComponent(ratioParam);
  if (!isAspectRatio(decodedRatio)) {
    notFound();
  }
  const aspectRatio = decodedRatio as AspectRatio;

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
    notFound();
  }

  // Check if session is public
  if (!session.is_public) {
    notFound();
  }

  return (
    <SharePreview
      session={session as SessionWithDetails}
      sessionId={sessionId}
      variant={variant}
      aspectRatio={aspectRatio}
    />
  );
}
