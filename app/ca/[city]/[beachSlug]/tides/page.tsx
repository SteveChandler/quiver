import type { Metadata } from "next";
import {
  renderBeachSubPage,
  generateBeachSubPageMetadata,
} from "@/lib/utils/beach-sub-page-utils";

export const dynamic = "force-dynamic";

export default async function CaBeachTidesPage(props: {
  params: Promise<{ city: string; beachSlug: string }>;
}) {
  const params = await props.params;
  return renderBeachSubPage({
    beachSlug: params.beachSlug,
    pageType: "tides",
    beachPath: `/ca/${params.city}/${params.beachSlug}`,
  });
}

export async function generateMetadata(props: {
  params: Promise<{ city: string; beachSlug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  return generateBeachSubPageMetadata({
    beachSlug: params.beachSlug,
    pageType: "tides",
    beachPath: `/ca/${params.city}/${params.beachSlug}`,
  });
}
