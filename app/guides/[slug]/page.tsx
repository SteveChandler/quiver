import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getHubRegion,
  type HubRegion,
} from "@/lib/data/hub-regions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { getBeachesByState } from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";
import { HubRegionClient } from "./hub-region-client";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { ArticleSchema } from "@/components/seo/article-schema";

export const revalidate = 3600; // Revalidate every hour

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  if (!params.slug.startsWith("surfing-")) {
    return {};
  }
  const regionSlug = params.slug.replace(/^surfing-/, "");
  const region = getHubRegion(regionSlug);

  if (!region) {
    return {};
  }

  return buildPageMetadata({
    title: region.title,
    description: region.description,
    path: `/guides/surfing-${region.slug}`,
    keywords: [
      `${region.name} surf guide`,
      `${region.name} surf spots`,
      `${region.name} surfing`,
      "surf forecast",
      "surf conditions",
    ],
    image: `/api/og/guide?title=${encodeURIComponent(region.title)}&region=${encodeURIComponent(region.name)}`,
  });
}

/**
 * Generate FAQ items for hub region
 */
function generateHubFAQ(region: HubRegion, beachCount: number) {
  return [
    {
      question: `How many surf spots are in ${region.name}?`,
      answer: `${region.name} has ${beachCount} surf spots documented in Quiver's database, ranging from beginner-friendly beach breaks to advanced reef and point breaks.`,
    },
    {
      question: `What are the best months to surf in ${region.name}?`,
      answer: `${region.name} offers year-round surfing opportunities. The best conditions typically vary by specific location and swell direction. Use Quiver's forecast tools to check real-time conditions.`,
    },
    {
      question: `Can I find beginner surf spots in ${region.name}?`,
      answer: `Yes! ${region.name} has numerous beginner-friendly surf spots. Use the beginner filter in the map below or explore our beginner-specific guides to find spots suitable for learning.`,
    },
    {
      question: `How do I get surf forecasts for ${region.name}?`,
      answer: `Quiver provides detailed surf forecasts for all beaches in ${region.name}, including wave height, wind conditions, tide information, and crowd predictions. Sign up for free to access forecasts.`,
    },
  ];
}

/**
 * Calculate region statistics from beaches
 */
function calculateRegionStats(beaches: Beach[]) {
  const beginnerCount = beaches.filter((b) => {
    const skill = b.skill_level?.toLowerCase() || "";
    return skill.includes("beginner") || skill.includes("longboard");
  }).length;

  const intermediateCount = beaches.filter((b) => {
    const skill = b.skill_level?.toLowerCase() || "";
    return (
      !skill.includes("beginner") &&
      !skill.includes("longboard") &&
      !skill.includes("advanced") &&
      !skill.includes("expert")
    );
  }).length;

  const advancedCount = beaches.filter((b) => {
    const skill = b.skill_level?.toLowerCase() || "";
    return skill.includes("advanced") || skill.includes("expert");
  }).length;

  // Group by city
  const cities = new Set(
    beaches.map((b) => b.city).filter((city): city is string => !!city)
  );

  return {
    total: beaches.length,
    beginner: beginnerCount,
    intermediate: intermediateCount,
    advanced: advancedCount,
    cities: cities.size,
  };
}

export default async function HubRegionPage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  if (!params.slug.startsWith("surfing-")) {
    return notFound();
  }
  const regionSlug = params.slug.replace(/^surfing-/, "");
  const region = getHubRegion(regionSlug);

  if (!region) {
    return notFound();
  }

  // Fetch all beaches for the region's states
  const allBeaches: Beach[] = [];
  for (const stateSlug of region.states) {
    const result = await getBeachesByState(stateSlug);
    if (result.success && result.data) {
      allBeaches.push(...result.data);
    }
  }

  if (allBeaches.length === 0) {
    return notFound();
  }

  const stats = calculateRegionStats(allBeaches);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Surf Guides", url: `${baseUrl}/guides` },
          {
            name: region.name,
            url: `${baseUrl}/guides/surfing-${region.slug}`,
          },
        ]}
      />
      <FAQSchema items={generateHubFAQ(region, stats.total)} />
      {/* WebPage JSON-LD with dateModified signals content freshness to Google */}
      <WebPageSchema
        name={region.title}
        url={`${baseUrl}/guides/surfing-${region.slug}`}
      />
      <ArticleSchema
        title={region.title}
        description={region.description}
        url={`/guides/surfing-${region.slug}`}
        imageUrl={`/api/og/guide?title=${encodeURIComponent(region.title)}&region=${encodeURIComponent(region.name)}`}
        datePublished="2026-03-26"
      />
      <HubRegionClient region={region} beaches={allBeaches} stats={stats} />
    </>
  );
}
