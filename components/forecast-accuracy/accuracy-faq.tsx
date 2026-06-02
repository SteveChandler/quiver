/**
 * AccuracyFaq
 *
 * Server component: visible FAQ section with an interactive accordion
 * (client-side via FAQSection). FAQPage JSON-LD is intentionally suppressed.
 */

import { FAQSection } from "@/components/seo/faq-section";

interface AccuracyFaqProps {
  beachCount: number;
}

export function AccuracyFaq({ beachCount }: AccuracyFaqProps) {
  const trackedBeachAnswer =
    beachCount > 0
      ? `The live report currently has qualifying forecast accuracy rows for ${beachCount} beaches. A beach needs enough validated forecast-buoy pairs to appear with beach-level MAE, improvement, last-updated, and confidence values.`
      : "The live report is currently building qualifying beach rows. Until enough validated forecast-buoy pairs are ready, Quiver shows methodology and in-progress status instead of an accuracy lift claim.";

  const faqItems = [
    {
      question: "How is forecast accuracy measured?",
      answer:
        "We use Mean Absolute Error (MAE), the average absolute difference between a predicted wave height and the actual wave height recorded by a nearby IOOS buoy. Lower MAE means more accurate forecasts. We report MAE in meters and compare Quiver's ML-corrected forecast against the raw NOAA marine forecast baseline.",
    },
    {
      question: "How often is accuracy data updated?",
      answer:
        "Accuracy data is evaluated on a rolling window. The page shows last-updated status on the live summary and each qualifying beach row so you can see when the latest forecast-buoy match was recorded.",
    },
    {
      question: "Where does the ground truth data come from?",
      answer:
        "Ground truth comes from the Integrated Ocean Observing System (IOOS) buoy network, a national network of ocean sensors operated by NOAA. Buoys report significant wave height every 1–6 hours. We match each forecast to the nearest buoy observation within a 3-hour window.",
    },
    {
      question: "What is the NOAA baseline?",
      answer:
        "The NOAA baseline is the raw National Weather Service (NWS) marine wave height forecast, unmodified. It represents the regional average forecast that any surfer can access from weather.gov. Quiver starts from this baseline and applies per-beach corrections. A positive improvement percentage is only shown as a lift claim when the current validated sample supports it.",
    },
    {
      question: "How does ML improve the forecasts?",
      answer:
        "NOAA publishes regional forecasts that don't account for individual beach geography. Quiver's model applies per-beach correction factors from historical buoy validation and local context such as swell direction, wind exposure, and terrain shape. The public report only claims lift when the current validated sample supports it.",
    },
    {
      question: `How many beaches are tracked for accuracy?`,
      answer: trackedBeachAnswer,
    },
  ];

  return <FAQSection items={faqItems} locationName="surf forecast accuracy" />;
}
