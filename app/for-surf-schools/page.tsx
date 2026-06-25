import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { StructuredData } from "@/components/seo/structured-data";
import {
  SurfSchoolsZinePage,
  type BeachOption,
} from "./_components/surf-schools-zine-page";

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

export default async function ForSurfSchoolsPage() {
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
    <>
      <StructuredData type="softwareApplication" />
      <SurfSchoolsZinePage beaches={beaches} />
    </>
  );
}
