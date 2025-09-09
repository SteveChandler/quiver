import { BottomNavigation } from "@/components/bottom-navigation";
import { BeachDetail } from "@/components/beach-detail";
import { getBeachById as fetchBeach } from "@/actions/beach/beach-query-actions";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";

export default function BeachDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <>
      <BeachDetail id={params.id} />

      <BottomNavigation />
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  // Avoid calling Supabase-backed actions in metadata to prevent
  // crashes on POST-induced re-renders (cookies() not available).
  // Use a safe fallback title/description without fetching.
  return buildPageMetadata({
    title: `Beach Surf Guide | Quiver`,
    description: `Conditions, intel, photos, and community tips for this beach.`,
    path: `/beach/${params.id}`,
  });
}
