/**
 * Visible methodology FAQ. FAQPage JSON-LD is intentionally suppressed by the
 * shared FAQSection component.
 */

import { FAQSection } from "@/components/seo/faq-section";

export function AccuracyFaq() {
  const faqItems = [
    {
      question: "What does Quiver use as wave-height ground truth?",
      answer:
        "For automated wave-height checks, Quiver pairs a saved forecast with a time-matched observation from a nearby IOOS or NOAA buoy. That observation is offshore significant wave height. The station, time window, forecast horizon, and missing-data rules must travel with any reported error score.",
    },
    {
      question: "What is significant wave height?",
      answer:
        "Significant wave height, often written as Hs, is a statistical description of the sea state around a buoy. It is not a direct measurement of the face of a wave breaking at a beach.",
    },
    {
      question: "Why is breaking face height different?",
      answer:
        "As swell reaches shore, exposure, bathymetry, refraction, tide, and the breaking point change the wave a surfer sees. A face-height forecast needs on-beach observations or a documented conversion before it can be validated against offshore Hs.",
    },
    {
      question: "Does Quiver claim an accuracy ranking over Surfline?",
      answer:
        "Quiver does not claim that ranking. A same-sample comparison has not been completed across identical beaches, timestamps, lead times, observations, and wave-height definitions.",
    },
    {
      question: "What would make a forecast comparison fair?",
      answer:
        "Freeze every provider's forecast before conditions arrive, evaluate the same variable at the same places and times, use the same ground truth and exclusion rules, then publish the sample size, date range, forecast horizon, and missing data.",
    },
    {
      question: "Do surfer reports train or calibrate production forecasts?",
      answer:
        "No. Session notes and condition reports are captured as field feedback and reviewed by operators. They do not automatically train or calibrate production forecasts.",
    },
    {
      question: "How should I judge any surf forecast?",
      answer:
        "Check whether the forecast names the variable it predicts, saves predictions before the outcome, uses matching observations, separates offshore height from breaking surf height, and publishes misses as clearly as hits.",
    },
  ];

  return <FAQSection items={faqItems} locationName="surf forecast accuracy" />;
}
