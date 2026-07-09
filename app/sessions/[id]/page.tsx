import { SessionDetailView } from "@/components/session-detail-view";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getSessionMetadata } from "@/actions/session-actions";
import { buildSessionShareImageUrl } from "@/lib/share/session-share";
import type { SessionWithDetails } from "@/types/database";
import { format } from "date-fns";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

async function getSharedSessionPreview(id: string) {
  const result = await getSessionMetadata(id);
  if (!result.success || !result.data) return null;

  const session = result.data;
  const beach = session.beach as unknown as { name: string } | null;
  const user = session.user as unknown as {
    full_name: string;
    username: string;
  } | null;
  const beachName = beach?.name || session.beach_name || "Unknown Beach";
  const userName = user?.full_name || user?.username || "A surfer";
  const rating =
    typeof session.rating === "number" ? session.rating : Number(session.rating);
  const safeRating = Number.isFinite(rating) ? rating : null;
  const dateText = session.arrival_time
    ? format(new Date(session.arrival_time), "MMM d, yyyy")
    : null;
  const photoUrl =
    (session as { featured_photo_url?: string | null }).featured_photo_url ||
    session.image_url ||
    null;
  const shareImageUrl = buildSessionShareImageUrl(
    session as unknown as SessionWithDetails,
  );

  return {
    rating: safeRating,
    title: `${userName}'s session at ${beachName}`,
    subtitle: [
      safeRating ? `${safeRating}/5 stars` : null,
      dateText,
      session.status === "planned" ? "Planned session" : "Logged session",
    ]
      .filter(Boolean)
      .join(" · "),
    imageUrl: photoUrl ?? shareImageUrl,
  };
}

export default async function SessionDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const sharedPreview = await getSharedSessionPreview(params.id);
  return (
    <div className="flex flex-col min-h-screen">
      {/* Breadcrumb Structured Data for SEO */}
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: baseUrl },
          { name: "Surf Sessions", url: `${baseUrl}/map` },
          { name: "Session Details", url: `${baseUrl}/sessions/${params.id}` },
        ]}
      />

      <SessionDetailView id={params.id} sharedPreview={sharedPreview} />
    </div>
  );
}

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  // Fetch session metadata for enhanced SEO
  try {
    const result = await getSessionMetadata(params.id);

    if (result.success && result.data) {
      const session = result.data;
      // Supabase joins return single objects for .single() queries, but TS types as arrays
      const beach = session.beach as unknown as { name: string } | null;
      const user = session.user as unknown as {
        full_name: string;
        username: string;
      } | null;
      const beachName = beach?.name || session.beach_name || "Unknown Beach";
      const userName = user?.full_name || user?.username || "Surfer";
      const ratingText = session.rating ? `${session.rating}-star` : "";
      const statusText =
        session.status === "completed" ? "Surf Session" : "Planned Session";
      const dateText = session.arrival_time
        ? format(new Date(session.arrival_time), "MMM d, yyyy")
        : "";

      // Build rich title and description
      const title =
        ratingText && dateText
          ? `${userName}'s ${ratingText} ${statusText} at ${beachName} - ${dateText}`
          : `${userName}'s ${statusText} at ${beachName}`;

      const description =
        ratingText && dateText
          ? `${userName} ${
              session.status === "completed" ? "surfed" : "is planning to surf"
            } at ${beachName} on ${dateText}. ${
              ratingText ? `Rated ${session.rating}/5 stars.` : ""
            } View conditions, photos, and session details.`
          : `View ${userName}'s surf session at ${beachName}. See conditions, photos, and session details on Quiver.`;

      return buildPageMetadata({
        title,
        description,
        path: `/sessions/${params.id}`,
        image: buildSessionShareImageUrl(session as unknown as SessionWithDetails),
      });
    }
  } catch (error) {
    // Fall through to generic metadata
  }

  // Fallback to generic metadata
  return buildPageMetadata({
    title: "Surf Session",
    description: "View surf session details, conditions, and photos on Quiver.",
    path: `/sessions/${params.id}`,
  });
}
