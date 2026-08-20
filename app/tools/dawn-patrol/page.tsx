/**
 * Dawn Patrol Calculator — /tools/dawn-patrol
 *
 * Shows first light, sunrise, golden hour, sunset and tide at dawn.
 * 7-day forecast table with simple good/skip verdicts.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
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
      "Find first light, sunrise, golden hour, and tide at dawn for any surf beach. 7-day dawn patrol forecast.",
    path: "/tools/dawn-patrol",
    image: "/images/tools/walking-sunset.jpg",
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

const DAWN_FAQ_ITEMS = [
  {
    question: "What time does it get light enough to surf?",
    answer:
      "Civil twilight begins about 30 minutes before sunrise. At this time there is enough light to read waves and see other surfers — perfect for dawn patrol. The exact time varies by location and season.",
  },
  {
    question: "What is a dawn patrol surf session?",
    answer:
      "A dawn patrol is a surf session that starts at first light — before most people are awake. Conditions are often best at dawn: lighter winds, fewer crowds, and glassy water before the sea breeze kicks in.",
  },
  {
    question: "What is civil twilight?",
    answer:
      "Civil twilight is the period just before sunrise (and just after sunset) when the sun is less than 6 degrees below the horizon. There is enough natural light to carry out most outdoor activities without artificial lighting — including surfing.",
  },
  {
    question: "Why is the tide important for dawn patrol?",
    answer:
      "Tide height affects wave quality and safety. Very high tide at first light can make reef breaks dangerously shallow on the sets, while too low a tide may expose rocks. Knowing the tide at dawn helps you pick the best window.",
  },
];

export default function DawnPatrolPage() {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Surfer's Toolkit", url: `${SITE_ORIGIN}/tools` },
          {
            name: "Dawn Patrol Calculator",
            url: `${SITE_ORIGIN}/tools/dawn-patrol`,
          },
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
            mainEntity: DAWN_FAQ_ITEMS.map((item) => ({
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
        <h1 className="sr-only">Dawn Patrol Calculator</h1>
        <Suspense>
          <DawnPatrolClient />
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
              Why dawn patrol is worth the early alarm
            </h2>
            <div className="space-y-3 text-sm text-[#B8C7E0] leading-relaxed">
              <p>
                <strong className="text-white">Dawn patrol</strong> — surfing at
                first light — is a tradition for a reason. In the hours before
                and just after sunrise, land cools overnight and creates light{" "}
                <strong className="text-white">offshore winds</strong> that
                groom incoming waves into clean, glassy lines. By mid-morning,
                solar heating reverses the flow, bringing onshore winds that
                chop up the surface.
              </p>
              <p>
                <strong className="text-white">
                  First light (civil twilight)
                </strong>{" "}
                begins about 25-30 minutes before sunrise. There&#39;s enough
                ambient light to read the lineup, spot sets on the horizon, and
                see other surfers — without the full glare of direct sun. Many
                experienced surfers consider this the prime window.
              </p>
              <p>
                This calculator shows first light, sunrise, sunset, and golden
                hour times for any of our monitored beaches, plus the{" "}
                <strong className="text-white">tide state at dawn</strong>{" "}
                so you know whether conditions will be rising or falling when you
                hit the water. Data comes from astronomical calculations
                adjusted for your beach&#39;s exact coordinates and timezone.
              </p>
              <p>
                First light is just the start of the call. Compare it with the{" "}
                <Link
                  href="/forecast"
                  className="text-[#F78E42] hover:underline"
                >
                  surf forecast
                </Link>
                ,{" "}
                <Link
                  href="/tide/san-diego"
                  className="text-[#F78E42] hover:underline"
                >
                  tide charts
                </Link>
                ,{" "}
                <Link
                  href="/water-temp/san-diego"
                  className="text-[#F78E42] hover:underline"
                >
                  water temperatures
                </Link>
                , and{" "}
                <Link href="/map" className="text-[#F78E42] hover:underline">
                  map
                </Link>{" "}
                before setting the alarm. If you are picking a specific zone,
                start from the{" "}
                <Link
                  href="/beaches/usa/ca/san-diego"
                  className="text-[#F78E42] hover:underline"
                >
                  San Diego beach pages
                </Link>
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
              {DAWN_FAQ_ITEMS.map((item) => (
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
