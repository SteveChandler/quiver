import { BottomNavigation } from "@/components/bottom-navigation";
import { BeachDetail } from "@/components/beach-detail";
import { getBeachById as fetchBeach } from "@/actions/beach/beach-query-actions";
import { getBeachById } from "@/actions/beach/beach-query-actions";
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
  const beach = await getBeachById(params.id);
  const name = beach?.name || "Beach";
  return buildPageMetadata({
    title: `${name} Surf Guide | Quiver`,
    description: `Conditions, intel, photos, and community tips for ${name}.`,
    path: `/beach/${params.id}`,
  });
}
