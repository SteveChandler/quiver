import { Suspense } from "react";
import { BottomNavigation } from "@/components/bottom-navigation";
import { BeachDetail } from "@/components/beach-detail";
import { CoachCard } from "@/components/recommendations/coach-card";
import { getBeachById as fetchBeach } from "@/actions/beach/beach-query-actions";
import { getBeachById } from "@/actions/beach/beach-query-actions";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";

async function CoachCardSection({ id }: { id: string }) {
  const res = await fetchBeach(id);
  const lat = res?.data?.latitude ?? 32.7157;
  const lon = res?.data?.longitude ?? -117.1611;
  return (
    <div className="px-4 pt-4">
      <CoachCard lat={lat} lon={lon} className="max-w-2xl mx-auto" />
    </div>
  );
}

export default function BeachDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <>
      {/* @ts-expect-error Async Server Component */}
      <Suspense fallback={<div className="px-4 pt-4" />}>
        <CoachCardSection id={params.id} />
      </Suspense>

      <Suspense fallback={<div className="p-4">Loading beach details…</div>}>
        <BeachDetail id={params.id} />
      </Suspense>

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
