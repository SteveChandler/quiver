import { SessionDetailView } from "@/components/session-detail-view";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getSessionMetadata } from "@/actions/session-actions";
import { format } from "date-fns";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app";

export default function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
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

      <SessionDetailView id={params.id} />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  // Fetch session metadata for enhanced SEO
  try {
    const result = await getSessionMetadata(params.id);

    if (result.success && result.data) {
      const session = result.data;
      // Supabase joins return single objects for .single() queries, but TS types as arrays
      const beach = session.beach as unknown as { name: string } | null;
      const user = session.user as unknown as { full_name: string; username: string } | null;
      const beachName =
        beach?.name || session.beach_name || "Unknown Beach";
      const userName =
        user?.full_name || user?.username || "Surfer";
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
        image: `/api/og/session/${params.id}?variant=1`,
      });
    }
  } catch (error) {
    // Fall through to generic metadata
  }

  // Fallback to generic metadata
  return buildPageMetadata({
    title: `Surf Session | Quiver`,
    description: "View surf session details, conditions, and photos on Quiver.",
    path: `/sessions/${params.id}`,
  });
}
