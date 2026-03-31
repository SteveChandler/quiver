/**
 * Surfboard Volume Calculator Tool
 *
 * Pure client-side calculator for surfboard volume based on
 * weight, skill level, fitness, and wave size preference.
 *
 * URL: /tools/board-calculator
 * URL params: ?weight=180&skill=intermediate&weightUnit=lbs
 */

import { Suspense } from "react";
import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/meta";
import { FAQSchema } from "@/components/seo/faq-schema";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { HowToBoardCalculatorSchema } from "@/components/seo/how-to-board-calculator-schema";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { SurfboardVolumeCalculator } from "@/components/tools/surfboard-volume-calculator";
import { SITE_URL } from "@/lib/constants/seo";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Surfboard Volume Calculator — Find Your Perfect Board Size",
  description:
    "Find the right surfboard volume for your weight, skill level, and the waves you ride. Get board type suggestions and a size chart. Free tool.",
  path: "/tools/board-calculator",
  keywords: [
    "surfboard volume calculator",
    "what size surfboard do I need",
    "surfboard size chart",
    "beginner surfboard size",
    "surfboard volume by weight",
    "surfboard liters calculator",
  ],
});

const FAQ_ITEMS = [
  {
    question: "What size surfboard do I need as a beginner?",
    answer:
      "Beginners should start with high-volume boards — at least 0.5 times their body weight in kilograms. For a 160-pound (73kg) beginner, that's around 40+ liters. A foamie (soft-top) in the 8-9 foot range is the most forgiving and accelerates learning fastest. Avoid shortboards until you can consistently catch and ride green waves.",
  },
  {
    question: "How do I calculate surfboard volume from weight?",
    answer:
      "The simplest formula: volume (liters) = weight (kg) × skill multiplier. Use 0.55 for beginners, 0.45 for intermediate, 0.38 for advanced, 0.34 for expert. Adjust by fitness (fit surfers can go 5-10% lower) and wave size (bigger waves = slightly less volume). This calculator does all of that automatically.",
  },
  {
    question: "What is a good surfboard volume for intermediate surfers?",
    answer:
      "Intermediate surfers typically need 0.40-0.50 times their weight in kg. A 180-pound (82kg) intermediate surfer should look for boards in the 33-41 liter range. A funboard (7'0\"-8'0\") or hybrid egg shape works well — enough volume to paddle comfortably but more maneuverable than a longboard.",
  },
  {
    question: "Does fitness level affect what surfboard I should ride?",
    answer:
      "Yes. Fitter surfers with stronger paddle technique can handle less volume and still catch waves efficiently. A very fit surfer can typically ride 10% less volume than their skill-level baseline. That might mean the difference between a 38L and 34L board — a significant change in feel and performance.",
  },
  {
    question: "What is the right surfboard volume for big waves?",
    answer:
      "For bigger, more powerful waves (6ft+), you generally want slightly less volume than your baseline — around 5% less. Less volume means the board sits lower in the water, which helps in steep, fast waves. Advanced and expert surfers riding overhead-plus conditions often use a \"step-up\" board: same skill-level volume but a longer, narrower shape for more hold.",
  },
];

export default function BoardCalculatorPage() {
  return (
    <>
      <HowToBoardCalculatorSchema />
      <FAQSchema items={FAQ_ITEMS} />
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_URL}/` },
          { name: "Free Surf Tools", url: `${SITE_URL}/tools` },
          { name: "Surfboard Volume Calculator", url: `${SITE_URL}/tools/board-calculator` },
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
              Surfboard Volume Calculator
            </h1>
            <p className="text-[#B8C7E0] text-base sm:text-lg">
              Find the right board size for your weight, skill level, and the
              waves you ride.
            </p>
          </div>
        </section>

        <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
          {/* Calculator — wrapped in Suspense for useSearchParams */}
          <Suspense
            fallback={
              <div
                className="h-96 rounded-xl border animate-pulse"
                style={{
                  background: "rgba(30, 37, 88, 0.7)",
                  borderColor: "rgba(64, 76, 146, 0.4)",
                }}
              />
            }
          >
            <SurfboardVolumeCalculator />
          </Suspense>

          {/* CTA — InlineSignupCta self-guards: renders null for authenticated users */}
          <div className="mt-10">
            <InlineSignupCta
              title="Found your board? Log your quiver and track your sessions."
              description="Quiver lets you log your boards, track sessions, and see how conditions matched up. Always free."
              primaryButtonText="Start tracking your surf"
              source="board-calculator"
            />
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
