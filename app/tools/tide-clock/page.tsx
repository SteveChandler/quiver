/**
 * Tide Clock Tool — /tools/tide-clock
 *
 * Real-time tide display for any beach. No signup required.
 * Data: NOAA CO-OPS hourly predictions via tide-clock API route.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { TideClockClient } from "@/components/tools/tide-clock-client";

export const revalidate = 300; // 5 minutes

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: "Tide Clock — Real-Time Tide Heights for Any Beach",
    description:
      "Check current tide height, next high tide, and next low tide for 279+ surf beaches. Free real-time tide clock powered by NOAA data.",
    path: "/tools/tide-clock",
    keywords: [
      "tide clock",
      "current tide",
      "what time is high tide",
      "tide chart today",
      "next high tide",
      "real-time tides",
      "tide heights",
    ],
  });
}

export default function TideClockPage() {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Free Surf Tools", url: `${SITE_ORIGIN}/tools` },
          { name: "Tide Clock", url: `${SITE_ORIGIN}/tools/tide-clock` },
        ]}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Quiver Tide Clock",
            url: `${SITE_ORIGIN}/tools/tide-clock`,
            description:
              "Real-time tide heights, next high tide, and 24-hour tide charts for 279+ surf beaches.",
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
                name: "What time is high tide today?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Use the Quiver Tide Clock to find the next high tide time at any beach. Search your beach and the clock will show the exact time and height of the next high and low tide.",
                },
              },
              {
                "@type": "Question",
                name: "How accurate are tide predictions?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Tide predictions from NOAA CO-OPS are highly accurate for most US coasts — typically within 5-10 minutes and a few inches. Extreme weather can cause deviations from predicted times.",
                },
              },
              {
                "@type": "Question",
                name: "What is the best tide for surfing?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "The best tide depends on the specific break. Many beach breaks work best at mid-tide, while reef breaks often prefer low to mid tide. Check the full forecast on Quiver for your beach's ideal tide window.",
                },
              },
              {
                "@type": "Question",
                name: "What does a rising vs falling tide mean for surfing?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "A rising tide (incoming) adds water depth, which can improve some breaks but close out others. A falling tide (outgoing) exposes more reef and can make waves more powerful but shallower. The push of water movement at the start of either tide often produces the best surf.",
                },
              },
            ],
          }),
        }}
      />

      <Suspense>
        <TideClockClient />
      </Suspense>
    </>
  );
}
