/**
 * Offshore Wind Checker — /tools/wind-checker
 *
 * Visual compass showing whether current wind is offshore, onshore, or cross-shore.
 * Data: Open-Meteo API (48hr forecast), beach orientation from beaches table.
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { SITE_URL } from "@/lib/constants/seo";
import { WindCheckerClient } from "@/components/tools/wind-checker-client";
import { getWindCheckerData } from "@/actions/tools/wind-checker-actions";

export const revalidate = 3600;

interface Props {
  searchParams: Promise<{ beach?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const beachSlug = params.beach;

  if (beachSlug) {
    return buildPageMetadata({
      title: `Offshore Wind at ${beachSlug.replace(/-/g, " ")} | Wind Checker`,
      description: `Is the wind offshore right now? Check current wind direction and speed for ${beachSlug.replace(/-/g, " ")}.`,
      path: `/tools/wind-checker?beach=${beachSlug}`,
    });
  }

  return buildPageMetadata({
    title: "Offshore Wind Checker — Is the Wind Good for Surfing?",
    description:
      "Check if the wind is offshore at your surf spot. Visual compass showing wind direction vs shore orientation. Free, real-time, no signup.",
    path: "/tools/wind-checker",
    keywords: [
      "offshore wind checker",
      "is the wind offshore",
      "offshore wind surfing",
      "wind direction surf",
      "good wind for surfing",
      "cross-shore wind",
    ],
  });
}

export default async function WindCheckerPage({ searchParams }: Props) {
  const params = await searchParams;
  const beachSlug = params.beach;

  let initialData = undefined;
  if (beachSlug) {
    const result = await getWindCheckerData(beachSlug);
    if (result.success) {
      initialData = result.data;
    }
  }

  const WIND_FAQ_ITEMS = [
    {
      question: "How do I know which direction is offshore for my beach?",
      answer:
        "Offshore direction depends on which way your beach faces. A beach facing west has an offshore wind from the east. Quiver calculates this automatically from each beach's shore orientation data.",
    },
    {
      question: "What wind speed is ideal for surfing?",
      answer:
        "Light offshore winds of 5-15 mph are ideal — they clean up the wave face without making paddling out too difficult. Winds over 20 mph (even offshore) can cause issues.",
    },
    {
      question: "Why does wind direction change throughout the day?",
      answer:
        "Sea breezes are common in coastal areas. As the land heats up during the day, air flows from the cooler ocean toward the land (onshore). At night and early morning, the land cools faster, often creating light offshore winds — which is why dawn patrol sessions often have the cleanest conditions.",
    },
  ];

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Free Tools", url: `${SITE_URL}/tools` },
          { name: "Offshore Wind Checker", url: `${SITE_URL}/tools/wind-checker` },
        ]}
      />
      <FAQSchema items={WIND_FAQ_ITEMS} />
      <WindCheckerClient initialData={initialData} initialBeachSlug={beachSlug} />
    </>
  );
}
