import { BottomNavigation } from "@/components/bottom-navigation";
import { BeachDetail } from "@/components/beach-detail";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getBeachBySlug, getBeachById } from "@/actions/beach/beach-query-actions";
import { notFound } from "next/navigation";
import { BeachPageStructuredData } from "@/components/seo/structured-data";

export default async function BeachDetailBySlugPage({
  params,
}: {
  params: { slug: string };
}) {
  // Resolve slug to ID on the server for stable downstream usage
  const slug = params.slug;
  const bySlug = await getBeachBySlug(slug);
  let beach = bySlug?.data || null;

  // Back-compat: if slug lookup fails, try treating slug as an ID
  if (!beach) {
    const byId = await getBeachById(slug);
    beach = byId?.data || null;
  }

  if (!beach) {
    notFound();
  }

  return (
    <>
      {/* Structured Data: Place/Beach */}
      <BeachPageStructuredData
        beachName={beach.name}
        description={`Surf conditions, tides, wind, swell and community intel for ${beach.name}.`}
        latitude={beach.latitude}
        longitude={beach.longitude}
        rating={(beach as any).average_rating || undefined}
        reviewCount={(beach as any).review_count || undefined}
      />

      {/* Client detail component uses id for API calls */}
      <BeachDetail id={beach.id} />

      <BottomNavigation />
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // Keep metadata generation side-effect free; don't depend on auth/session
  const slug = params.slug;
  // Try to resolve name synchronously but without relying on cookies/POST contexts
  try {
    const result = await getBeachBySlug(slug);
    const beach = result?.data || null;
    if (beach) {
      return buildPageMetadata({
        title: `${beach.name} Surf Guide`,
        description: `Today's surf summary, tides, wind, swell, cams, and community intel for ${beach.name}.`,
        path: `/beach/${slug}`,
      });
    }
  } catch {}

  return buildPageMetadata({
    title: `Beach Surf Guide | Quiver`,
    description: `Conditions, intel, photos, and community tips for this beach.`,
    path: `/beach/${slug}`,
  });
}


