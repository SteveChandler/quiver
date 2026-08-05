import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { ZineSurface } from "@/components/zine";
import {
  BusinessesEmbedPromo,
  type BeachOption,
} from "./_components/businesses-embed-promo";
import { validateInitialBeachSlug } from "@/components/embed-promo/beach-selection";
import { getEmbedPromoBeachOptions } from "@/components/embed-promo/cached-beach-options";

interface Props {
  searchParams: Promise<{ beach?: string | string[] }>;
}

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

export default async function ForBusinessesPage({ searchParams }: Props) {
  const params = await searchParams;
  const beaches: BeachOption[] = await getEmbedPromoBeachOptions();
  const initialSlug = validateInitialBeachSlug(beaches, params.beach);

  return (
    <ZineSurface
      sectionLabel="For businesses"
      editionLabel="Embed the surf, free"
      data-testid="for-businesses-zine-surface"
    >
      <BusinessesEmbedPromo beaches={beaches} initialSlug={initialSlug} />
    </ZineSurface>
  );
}
