/**
 * Wave Height Converter Tool
 *
 * Pure client-side converter between face height (ft/m), Hawaiian scale,
 * and back/trough height. No API calls.
 *
 * URL: /tools/wave-converter
 * URL params: ?value=6&unit=face_ft
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { buildPageMetadata } from "@/lib/seo/meta";
import { FAQSchema } from "@/components/seo/faq-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { HowToWaveConverterSchema } from "@/components/seo/how-to-wave-converter-schema";
import { WaveHeightConverter } from "@/components/tools/wave-height-converter";
import { SITE_URL } from "@/lib/constants/seo";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Wave Height Converter — Feet, Meters & Hawaiian Scale",
  description:
    "Convert wave heights between feet, meters, and Hawaiian scale instantly. Includes a reference table and explanation of how waves are measured.",
  path: "/tools/wave-converter",
  keywords: [
    "wave height converter",
    "hawaiian scale waves",
    "feet to meters waves",
    "4 foot waves in meters",
    "surf wave size converter",
    "wave measurement",
  ],
});

const FAQ_ITEMS = [
  {
    question: "What is Hawaiian scale for waves?",
    answer:
      "Hawaiian scale measures waves at roughly half the face height. A 4-foot Hawaiian wave has a face height of around 8 feet. The tradition comes from Hawaiian surfers who measured the back of the wave rather than the face. It's why North Shore surf reports can sound deceptively small — '10-foot Hawaiian' is a very serious 18-20 foot face.",
  },
  {
    question: "What does 4 foot waves look like in meters?",
    answer:
      "4 feet equals approximately 1.2 meters. A 4-foot wave is roughly chest high on an average surfer. In Hawaiian scale, 4 feet face height is reported as 2 feet. This is a fun, manageable size for intermediate surfers at most breaks.",
  },
  {
    question: "How do surf forecasts measure wave height?",
    answer:
      "Most modern surf forecasts (including Quiver) use face height in feet — the height of the wave face as seen by a surfer paddling toward it. Some forecasts use significant wave height (Hs) from buoy data, which is a statistical average and typically smaller than surfable face height. Always check which scale a forecast uses.",
  },
  {
    question: "What is a good wave height for beginners?",
    answer:
      "Beginners generally do best in waves 2-3 feet face height (knee to waist high). These waves have enough power to push you but aren't large enough to be dangerous. Once comfortable, 4-5 foot waves (chest to head high) are a great next step. Avoid surf above head high until you're a confident swimmer and have solid pop-up technique.",
  },
  {
    question: "What is back height or trough height?",
    answer:
      "Back height (also called trough height) measures the wave from the trough — the lowest point at its base — to the crest, seen from behind the wave. It's roughly 70% of the face height. Some forecasters and older reports use back height because it's easier to measure from the shore.",
  },
];

export default function WaveConverterPage() {
  return (
    <>
      <HowToWaveConverterSchema />
      <FAQSchema items={FAQ_ITEMS} />
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_URL}/` },
          { name: "Free Surf Tools", url: `${SITE_URL}/tools` },
          { name: "Wave Height Converter", url: `${SITE_URL}/tools/wave-converter` },
        ]}
      />

      <div className="min-h-screen" style={{ background: "#0F1535" }}>
        {/* Header */}
        <section
          className="noise-texture border-b"
          style={{
            background: "linear-gradient(180deg, #1E2558 0%, #252D6B 100%)",
            borderColor: "rgba(64,76,146,0.4)",
          }}
        >
          <div className="container mx-auto max-w-3xl px-4 py-10 sm:py-14">
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-3">
              Wave Height Converter
            </h1>
            <p className="text-[#B8C7E0] text-base sm:text-lg">
              Convert between feet, meters, and Hawaiian scale instantly.
            </p>
          </div>
        </section>

        <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
          {/* Calculator — wrapped in Suspense for useSearchParams */}
          <Suspense
            fallback={
              <div
                className="h-64 rounded-xl border animate-pulse"
                style={{
                  background: "rgba(30, 37, 88, 0.7)",
                  borderColor: "rgba(64, 76, 146, 0.4)",
                }}
              />
            }
          >
            <WaveHeightConverter />
          </Suspense>

          {/* CTA — links to forecast page (non-auth, safe for all users) */}
          <div
            className="mt-10 rounded-xl border p-6"
            style={{
              background: "rgba(247, 142, 66, 0.08)",
              borderColor: "rgba(247, 142, 66, 0.3)",
            }}
          >
            <p className="text-base font-semibold text-white">
              Know your wave size — now check the forecast.
            </p>
            <p className="mt-1 text-sm text-[#B8C7E0]">
              See real-time wave heights, swell periods, and conditions at 279+
              beaches.
            </p>
            <Link
              href="/forecast"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ background: "#F78E42", color: "#fff" }}
            >
              View surf forecast
            </Link>
          </div>

          {/* FAQ section */}
          <section aria-labelledby="faq-heading" className="mt-12">
            <h2
              id="faq-heading"
              className="font-heading text-xl font-bold text-white mb-4"
            >
              Frequently asked questions
            </h2>
            <div className="space-y-2">
              {FAQ_ITEMS.map((item) => (
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
