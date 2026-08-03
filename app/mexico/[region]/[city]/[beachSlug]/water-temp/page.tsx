import type { Metadata } from "next";
import {
  renderBeachSubPage,
  generateBeachSubPageMetadata,
} from "@/lib/utils/beach-sub-page-utils";

export const dynamic = "force-static";
export const revalidate = 3600;

export default async function MexicoBeachWaterTempPage(props: {
  params: Promise<{ region: string; city: string; beachSlug: string }>;
}) {
  const params = await props.params;
  return renderBeachSubPage({
    beachSlug: params.beachSlug,
    pageType: "water-temp",
    beachPath: `/mexico/${params.region}/${params.city}/${params.beachSlug}`,
    expectedMexicoLocation: {
      region: params.region,
      city: params.city,
    },
  });
}

export async function generateMetadata(props: {
  params: Promise<{ region: string; city: string; beachSlug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  return generateBeachSubPageMetadata({
    beachSlug: params.beachSlug,
    pageType: "water-temp",
    beachPath: `/mexico/${params.region}/${params.city}/${params.beachSlug}`,
    expectedMexicoLocation: {
      region: params.region,
      city: params.city,
    },
  });
}
