import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidStateSlug } from "@/lib/utils/beach-url-utils";
import {
  renderBeachSubPage,
  generateBeachSubPageMetadata,
} from "@/lib/utils/beach-sub-page-utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    intent: string;
    city: string;
    beachSlug: string;
  }>;
}

export default async function BeachTidesPage(props: PageProps) {
  const params = await props.params;
  const { intent, city, beachSlug } = params;

  // Only state slugs have tides sub-pages
  if (!isValidStateSlug(intent)) {
    notFound();
  }

  return renderBeachSubPage({
    beachSlug,
    pageType: "tides",
    beachPath: `/${intent}/${city}/${beachSlug}`,
  });
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const { intent, city, beachSlug } = params;

  if (!isValidStateSlug(intent)) {
    return {};
  }

  return generateBeachSubPageMetadata({
    beachSlug,
    pageType: "tides",
    beachPath: `/${intent}/${city}/${beachSlug}`,
  });
}
