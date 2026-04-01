/**
 * Tide Clock Tool — /tools/tide-clock
 *
 * Real-time tide display for any beach.
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
      "Check current tide height, next high tide, and next low tide for any surf beach. Real-time tide clock powered by NOAA data.",
    path: "/tools/tide-clock",
    image: "/images/tools/tide-pools.jpg",
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

const TIDE_FAQ_ITEMS = [
  {
    question: "What time is high tide today?",
    answer:
      "Search for your beach above — the clock shows the exact time and height of the next high and low tide.",
  },
  {
    question: "How accurate are tide predictions?",
    answer:
      "NOAA predictions are typically accurate within 5-10 minutes and a few inches for US coastlines. Strong storms or unusual weather can shift actual times by more.",
  },
  {
    question: "What is the best tide for surfing?",
    answer:
      "It depends on the break. Beach breaks often work best at mid-tide, while reef breaks tend to prefer low to mid tide. Check the full forecast for your beach's ideal conditions.",
  },
  {
    question: "What does a rising vs falling tide mean for surfing?",
    answer:
      "A rising (incoming) tide adds depth — good for some breaks, too deep for others. A falling (outgoing) tide exposes reef and can make waves more hollow. The first hour or two of either change, when water moves fastest, often produces the best surf.",
  },
];

export default function TideClockPage() {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Surfer's Toolkit", url: `${SITE_ORIGIN}/tools` },
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
              "Real-time tide heights, next high tide, and 24-hour tide charts for any surf beach.",
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
            mainEntity: TIDE_FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          }),
        }}
      />

      <div className="min-h-screen" style={{ background: "#0F1535" }}>
        <Suspense>
          <TideClockClient />
        </Suspense>

        {/* Server-rendered educational content for SEO */}
        <div className="container mx-auto max-w-4xl px-4 pb-12">
          <section
            className="rounded-2xl border p-6 space-y-4"
            style={{
              background: "rgba(30, 37, 88, 0.7)",
              borderColor: "rgba(64,76,146,0.4)",
            }}
          >
            <h2 className="font-heading text-lg font-bold text-white">
              How the Quiver tide clock works
            </h2>
            <div className="space-y-3 text-sm text-[#B8C7E0] leading-relaxed">
              <p>
                Search any beach to see the{" "}
                <strong className="text-white">current tide height</strong>,
                next high and low times, and a 24-hour tide curve. The display
                adjusts automatically for each beach&#39;s local timezone.
              </p>
              <p>
                Predictions come from{" "}
                <strong className="text-white">NOAA</strong> — the same source
                used by the Coast Guard and National Weather Service. Typically
                accurate within 5-10 minutes and a few inches for US
                coastlines.
              </p>
              <p>
                Most US beaches see two highs and two lows per day, roughly 6
                hours apart. The transition between them — when the water is
                moving fastest — often produces the{" "}
                <strong className="text-white">
                  best conditions for surfing
                </strong>
                .
              </p>
            </div>
          </section>

          {/* Visual FAQ */}
          <section className="mt-6">
            <h2 className="font-heading text-xl font-bold text-white mb-4">
              Frequently asked questions
            </h2>
            <div className="space-y-2">
              {TIDE_FAQ_ITEMS.map((item) => (
                <details
                  key={item.question}
                  className="rounded-xl border group"
                  style={{
                    background: "rgba(30, 37, 88, 0.7)",
                    borderColor: "rgba(64, 76, 146, 0.4)",
                  }}
                >
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-white list-none">
                    {item.question}
                    <span
                      className="ml-4 text-[#7A8CC0] transition-transform group-open:rotate-180 shrink-0"
                      aria-hidden
                    >
                      ↓
                    </span>
                  </summary>
                  <div className="px-5 pb-4 text-sm text-[#B8C7E0] leading-relaxed">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
