/**
 * AccuracyFaq
 *
 * Server component: visible FAQ section with an interactive accordion
 * (client-side via FAQSection). FAQPage JSON-LD is intentionally suppressed.
 */

import { FAQSection } from "@/components/seo/faq-section";
import {
  CURATED_ACCURACY,
  CURATED_MATCH,
} from "@/lib/forecast-accuracy/curated-comparison";

export function AccuracyFaq() {
  const { beachCount, vsNoaaImprovementPct } = CURATED_ACCURACY;

  const faqItems = [
    {
      question: "Does Quiver predict which days I'll actually like?",
      answer: `That's the whole idea. Surfline's star rating reflects the average surfer at a break — but a 3-star day for the average can be a great day for you, depending on your board, skill, and conditions you favor. Quiver builds a personal Match Score from the sessions you log. Across ${CURATED_MATCH.comparablePairs.toLocaleString("en-US")} pairs of rated sessions, when Quiver scored one day a stronger personal match than another, it was the one the surfer rated higher about ${CURATED_MATCH.concordancePct}% of the time — and it sharpens as you log more.`,
    },
    {
      question: "How is forecast accuracy measured?",
      answer:
        "We use Mean Absolute Error (MAE): the average absolute difference between a predicted wave height and the actual wave height recorded by a nearby IOOS buoy. Lower MAE means a more accurate forecast. We report MAE in meters and compare Quiver against both the raw NOAA marine baseline and Surfline.",
    },
    {
      question: "Is Quiver really more accurate than Surfline?",
      answer:
        "Yes. Against nearby buoy readings, Quiver's average wave-height miss came in lower than Surfline's — and Quiver is free. Surfline is a strong, established product; this isn't a strawman. Quiver simply tunes each break to local conditions and the buoy receipts back it up.",
    },
    {
      question: "How much better is Quiver than the NOAA forecast?",
      answer: `Quiver's wave-height error is about ${vsNoaaImprovementPct}% lower than the raw NOAA marine baseline — more than twice as sharp. NOAA publishes broad regional forecasts; Quiver corrects them per beach using local exposure, swell direction, and spot shape.`,
    },
    {
      question: "Where does the ground truth data come from?",
      answer:
        "Ground truth comes from the Integrated Ocean Observing System (IOOS) buoy network, a national network of ocean sensors operated by NOAA. Buoys report significant wave height every 1–6 hours, and we match each forecast to the nearest buoy observation within a short window.",
    },
    {
      question: "What is the NOAA baseline?",
      answer:
        "The NOAA baseline is the raw National Weather Service (NWS) marine wave-height forecast, unmodified — the regional average any surfer can access from weather.gov. Quiver starts from this baseline and applies per-beach corrections.",
    },
    {
      question: "How many beaches does Quiver track for accuracy?",
      answer: `Quiver tracks forecast accuracy across ${beachCount}+ beaches, validating each against nearby buoy observations.`,
    },
  ];

  return <FAQSection items={faqItems} locationName="surf forecast accuracy" />;
}
