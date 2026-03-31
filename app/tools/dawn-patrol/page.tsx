/**
 * Dawn Patrol Calculator — /tools/dawn-patrol
 *
 * Shows first light, sunrise, golden hour, sunset and tide at dawn.
 * 7-day forecast table with simple good/skip verdicts.
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { DawnPatrolClient } from "@/components/tools/dawn-patrol-client";

export const revalidate = 3600; // 1 hour

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: "Dawn Patrol Calculator — Sunrise & First Light Times",
    description:
      "Find first light, sunrise, golden hour, and tide at dawn for any surf beach. 7-day dawn patrol forecast. Always free.",
    path: "/tools/dawn-patrol",
    keywords: [
      "dawn patrol surf",
      "sunrise surf",
      "first light beach",
      "surf sunrise time",
      "dawn patrol calculator",
      "when does it get light at beach",
      "civil twilight surf",
    ],
  });
}

export default function DawnPatrolPage() {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Free Surf Tools", url: `${SITE_ORIGIN}/tools` },
          { name: "Dawn Patrol Calculator", url: `${SITE_ORIGIN}/tools/dawn-patrol` },
        ]}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Quiver Dawn Patrol Calculator",
            url: `${SITE_ORIGIN}/tools/dawn-patrol`,
            description:
              "First light, sunrise, golden hour, and tide at dawn for any surf beach. 7-day dawn patrol forecast.",
            applicationCategory: "SportsApplication",
            operatingSystem: "Any",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            publisher: {
              "@type": "Organization",
              name: "Quiver",
              url: SITE_ORIGIN,
            },
          }),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "What time does it get light enough to surf?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Civil twilight begins about 30 minutes before sunrise. At this time there is enough light to read waves and see other surfers — perfect for dawn patrol. The exact time varies by location and season.",
                },
              },
              {
                "@type": "Question",
                name: "What is a dawn patrol surf session?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "A dawn patrol is a surf session that starts at first light — before most people are awake. Conditions are often best at dawn: lighter winds, fewer crowds, and glassy water before the sea breeze kicks in.",
                },
              },
              {
                "@type": "Question",
                name: "What is civil twilight?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Civil twilight is the period just before sunrise (and just after sunset) when the sun is less than 6 degrees below the horizon. There is enough natural light to carry out most outdoor activities without artificial lighting — including surfing.",
                },
              },
              {
                "@type": "Question",
                name: "Why is the tide important for dawn patrol?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Tide height affects wave quality and safety. Very high tide at first light can make reef breaks dangerously shallow on the sets, while too low a tide may expose rocks. Knowing the tide at dawn helps you pick the best window.",
                },
              },
            ],
          }),
        }}
      />

      <DawnPatrolClient />
    </>
  );
}
