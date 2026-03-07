/**
 * AccuracyFaq
 *
 * Server component — FAQ section with FAQPage JSON-LD structured data and
 * an interactive accordion (client-side via FAQSection).
 */

import { FAQSchema } from "@/components/seo/faq-schema";
import { FAQSection } from "@/components/seo/faq-section";

interface AccuracyFaqProps {
  beachCount: number;
}

export function AccuracyFaq({ beachCount }: AccuracyFaqProps) {
  const faqItems = [
    {
      question: "How is forecast accuracy measured?",
      answer:
        "We use Mean Absolute Error (MAE) — the average absolute difference between a predicted wave height and the actual wave height recorded by a nearby IOOS buoy. Lower MAE means more accurate forecasts. We report MAE in meters and compare Quiver's ML-corrected forecast against the raw NOAA marine forecast baseline.",
    },
    {
      question: "How often is accuracy data updated?",
      answer:
        "Accuracy data updates daily. We use a rolling 14-day window, so today's numbers reflect the past two weeks of forecast-versus-buoy comparisons. This keeps the metrics current and avoids overfitting to seasonal averages.",
    },
    {
      question: "Where does the ground truth data come from?",
      answer:
        "Ground truth comes from the Integrated Ocean Observing System (IOOS) buoy network — a national network of ocean sensors operated by NOAA. Buoys report significant wave height every 1–6 hours. We match each forecast to the nearest buoy observation within a 3-hour window.",
    },
    {
      question: "What is the NOAA baseline?",
      answer:
        "The NOAA baseline is the raw National Weather Service (NWS) marine wave height forecast — unmodified. It represents the regional average forecast that any surfer can access from weather.gov. Quiver's ML model starts from this baseline and applies per-beach corrections. The improvement percentage shown is how much smaller our error is compared to using the raw NOAA forecast.",
    },
    {
      question: "How does ML improve the forecasts?",
      answer:
        "NOAA publishes regional forecasts that don't account for individual beach geography. Quiver's XGBoost model learns per-beach bias correction factors from historical buoy observations. It adjusts for each beach's unique exposure to swell direction, wind patterns, and terrain features like offshore reefs and headlands. The model retrains weekly on a 90-day rolling window of matched data.",
    },
    {
      question: `How many beaches are tracked for accuracy?`,
      answer: `We currently track forecast accuracy for ${beachCount} beaches with at least 10 validated forecast-buoy pairs. Beaches need sufficient matched data to appear in accuracy statistics. As more buoy observations accumulate, additional beaches are added automatically. New beaches typically reach minimum data thresholds within 2–4 weeks of activation.`,
    },
  ];

  return (
    <>
      <FAQSchema items={faqItems} />
      <FAQSection items={faqItems} locationName="surf forecast accuracy" />
    </>
  );
}
