/**
 * Public Share Landing Page
 * Route: /s/[sessionId]
 * Public access - no authentication required
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next/types";
import { createServerClient } from "@/lib/supabase";
import type { SessionWithDetails } from "@/types/database";
import { buildPageMetadata } from "@/lib/seo/meta";
import { buildSessionDescription } from "@/lib/share/share-text-builder";
import { SharePageClient } from "./share-client";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

/**
 * Fetch session data server-side
 */
async function getPublicSession(
  sessionId: string
): Promise<SessionWithDetails | null> {
  const supabase = createServerClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select(
      `
      *,
      beaches (
        id,
        name,
        slug,
        lat,
        lon
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

  if (error || !session) {
    return null;
  }

  // Only return public sessions
  if (!session.is_public) {
    return null;
  }

  return session as SessionWithDetails;
}

/**
 * Generate metadata for SEO and social sharing
 */
export async function generateMetadata({
  params,
}: {
  params: { sessionId: string };
}): Promise<Metadata> {
  const session = await getPublicSession(params.sessionId);

  if (!session) {
    return {
      title: "Session Not Found",
      description: "This session is private or doesn't exist.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const beachName = session.beaches?.name || "Unknown Beach";
  const userName = session.profiles?.full_name || "Surfer";
  const rating = session.rating ? `⭐ ${session.rating}/5` : "";

  const title = `${beachName} - ${userName}'s Surf Session ${rating}`;
  const description = buildSessionDescription(session);

  return buildPageMetadata({
    title,
    description,
    path: `/s/${params.sessionId}`,
    image: `/api/og/session/${params.sessionId}?variant=1`,
    keywords: [
      "surf session",
      "surfing",
      beachName,
      "surf report",
      "surf tracker",
    ],
  });
}

/**
 * Public Share Page Component (Server Component)
 */
export default async function SharePage({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await getPublicSession(params.sessionId);

  // Return 404 if session is private or doesn't exist
  if (!session) {
    notFound();
  }

  const beachName = session.beaches?.name || "Unknown Beach";

  return (
    <>
      {/* Breadcrumb Structured Data for SEO */}
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: baseUrl },
          { name: "Surf Sessions", url: `${baseUrl}/sessions` },
          {
            name: `${beachName} Session`,
            url: `${baseUrl}/s/${params.sessionId}`,
          },
        ]}
      />

      {/* JSON-LD Structured Data for SportsEvent */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            name: `Surf Session at ${beachName}`,
            description: buildSessionDescription(session),
            location: session.beaches?.lat
              ? {
                  "@type": "Place",
                  name: beachName,
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: session.beaches.lat,
                    longitude: session.beaches.lon,
                  },
                }
              : {
                  "@type": "Place",
                  name: beachName,
                },
            startDate: session.arrival_time,
            endDate:
              session.duration_minutes && session.duration_minutes > 0
                ? new Date(
                    new Date(session.arrival_time).getTime() +
                      session.duration_minutes * 60 * 1000
                  ).toISOString()
                : undefined,
            aggregateRating: session.rating
              ? {
                  "@type": "AggregateRating",
                  ratingValue: session.rating,
                  bestRating: 5,
                  ratingCount: 1,
                }
              : undefined,
            organizer: {
              "@type": "Person",
              name: session.profiles?.full_name || "QuiverSurf User",
            },
          }),
        }}
      />

      {/* Client Component - Handles UI and auth state */}
      <SharePageClient session={session} sessionId={params.sessionId} />
    </>
  );
}
