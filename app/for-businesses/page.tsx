import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { ZineSurface } from "@/components/zine";
import {
  BusinessesEmbedPromo,
  type BeachOption,
} from "./_components/businesses-embed-promo";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Free Surf Conditions Widget for Coastal Businesses",
  description:
    "Add live wave, wind, and tide data to your business website. Perfect for hotels, restaurants, and vacation rentals. No code needed.",
  path: "/for-businesses",
  keywords: [
    "surf conditions widget",
    "embed tide chart",
    "free surf forecast widget",
    "coastal business website",
    "live surf data embed",
  ],
});

export default async function ForBusinessesPage() {
  const response = await getBeaches();
  const beaches: BeachOption[] =
    response.success && response.data
      ? response.data
          .filter((b) => b.slug && b.name)
          .map((b) => ({
            name: b.name,
            slug: b.slug!,
            city: b.city,
            state: b.state,
          }))
      : [];

  return (
    <ZineSurface
      sectionLabel="For businesses"
      editionLabel="Embed the surf, free"
      data-testid="for-businesses-zine-surface"
    >
      <BusinessesEmbedPromo beaches={beaches} />
    </ZineSurface>
  );
}
