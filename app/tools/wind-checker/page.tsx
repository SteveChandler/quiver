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
import { capitalize } from "@/lib/utils/text-utils";
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
      title: `Offshore Wind at ${capitalize(beachSlug)} | Wind Checker`,
      description: `Is the wind offshore right now? Check current wind direction and speed for ${capitalize(beachSlug)}.`,
      path: `/tools/wind-checker?beach=${beachSlug}`,
      image: "/images/tools/wind-checker-screenshot.jpg",
    });
  }

  return buildPageMetadata({
    title: "Offshore Wind Checker — Is the Wind Good for Surfing?",
    description:
      "Check if the wind is offshore at your surf spot. Visual compass showing wind direction vs shore orientation, updated hourly.",
    path: "/tools/wind-checker",
    image: "/images/tools/wind-checker-screenshot.jpg",
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
        "Offshore direction depends on which way your beach faces. A beach facing west has offshore wind from the east. Quiver calculates this automatically from each beach's shore orientation data.",
    },
    {
      question: "What wind speed is ideal for surfing?",
      answer:
        "Light offshore winds of 5\u201315 mph are ideal \u2014 they clean up the wave face without making paddling out too difficult. Winds over 20 mph (even offshore) can cause issues, and winds over 30 mph are dangerous for most surfers.",
    },
    {
      question: "Why does wind direction change throughout the day?",
      answer:
        "As the land heats up during the day, air flows from the cooler ocean toward land \u2014 creating onshore breezes. At night and early morning, the land cools faster, often producing light offshore winds. This is why dawn patrol sessions typically have the cleanest conditions.",
    },
    {
      question: "How accurate is the wind forecast?",
      answer:
        "Wind data comes from the Open-Meteo weather model, updated hourly. Near-shore forecasts are generally accurate within 2\u20135 mph for the next 12 hours. Local terrain features like cliffs and buildings can cause deviations from the forecast.",
    },
  ];

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Surfer's Toolkit", url: `${SITE_URL}/tools` },
          { name: "Offshore Wind Checker", url: `${SITE_URL}/tools/wind-checker` },
        ]}
      />
      <FAQSchema items={WIND_FAQ_ITEMS} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Quiver Offshore Wind Checker",
            url: `${SITE_URL}/tools/wind-checker`,
            description:
              "Check if the wind is offshore at your surf spot. Visual compass showing wind direction vs shore orientation.",
            applicationCategory: "SportsApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            publisher: {
              "@type": "Organization",
              name: "Quiver",
              url: SITE_URL,
            },
          }),
        }}
      />
      <div className="min-h-screen" style={{ background: "#0F1535" }}>
        <WindCheckerClient
          initialData={initialData}
          initialBeachSlug={beachSlug}
        />

        <div className="container mx-auto max-w-4xl px-4 pb-12">
          <section
            className="rounded-2xl border p-6 space-y-4"
            style={{
              background: "rgba(30, 37, 88, 0.7)",
              borderColor: "rgba(64,76,146,0.4)",
            }}
          >
            <h2 className="font-heading text-lg font-bold text-white">
              What is offshore wind?
            </h2>
            <div className="space-y-3 text-sm text-[#B8C7E0] leading-relaxed">
              <p>
                <strong className="text-white">Offshore wind</strong> blows from
                land toward the ocean — it grooms incoming waves into clean,
                well-defined lines. A light offshore at 5–15 mph is
                ideal. Above 20 mph it hollows waves but makes paddling out
                difficult.
              </p>
              <p>
                <strong className="text-white">Onshore wind</strong> blows from
                ocean toward land — it chops up the wave surface. The
                stronger the onshore, the messier the conditions.
              </p>
              <p>
                <strong className="text-white">Cross-shore wind</strong> runs
                parallel to the beach — it creates some chop on one side
                but is usually more rideable than onshore. Wind data is sourced
                from the{" "}
                <strong className="text-white">
                  Open-Meteo weather model
                </strong>
                , updated hourly.
              </p>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="font-heading text-xl font-bold text-white mb-4">
              Frequently asked questions
            </h2>
            <div className="space-y-2">
              {WIND_FAQ_ITEMS.map((item) => (
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
                      &darr;
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
