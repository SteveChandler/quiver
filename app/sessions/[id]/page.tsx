import { SessionDetailView } from "@/components/session-detail-view";
import { BottomNavigation } from "@/components/bottom-navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getSessionById } from "@/actions/session-actions";

export default function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <SessionDetailView id={params.id} />
      <BottomNavigation />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  // We can't fetch userId here without auth; use a generic title
  return buildPageMetadata({
    title: `Session ${params.id} | Quiver`,
    description: "Surf session details and photos.",
    path: `/sessions/${params.id}`,
  });
}
