import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import {
  SurfSchoolsZinePage,
  type BeachOption,
} from "./_components/surf-schools-zine-page";
import { validateInitialBeachSlug } from "@/components/embed-promo/beach-selection";
import { getEmbedPromoBeachOptions } from "@/components/embed-promo/cached-beach-options";

interface Props {
  searchParams: Promise<{ beach?: string | string[] }>;
}

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Free Surf Conditions Widget for Surf Schools",
  description:
    "Embed real-time wave, wind, and tide data on your surf school website. Always current, no code needed. Powered by Quiver.",
  path: "/for-surf-schools",
  keywords: [
    "surf school widget",
    "embed surf conditions",
    "free surf forecast widget",
    "surf school website",
    "live surf conditions embed",
  ],
});

export default async function ForSurfSchoolsPage({ searchParams }: Props) {
  const params = await searchParams;
  const beaches: BeachOption[] = await getEmbedPromoBeachOptions();
  const initialSlug = validateInitialBeachSlug(beaches, params.beach);

  return (
    <SurfSchoolsZinePage beaches={beaches} initialSlug={initialSlug} />
  );
}
