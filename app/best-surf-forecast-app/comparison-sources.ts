export interface ComparisonSourceLink {
  label: string;
  href: string;
  note: string;
}

export const COMPARISON_SOURCE_REVIEW = {
  lastVerified: "2026-07-08",
  reviewedBy: "Quiver editorial team",
  // Pricing and product features change often enough to warrant review every two months.
  freshnessThresholdDays: 60,
} as const;

export const COMPARISON_SOURCE_LINKS: readonly ComparisonSourceLink[] = [
  {
    label: "Quiver App Store listing",
    href: "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320",
    note:
      "Quiver free listing with custom spots and session logging, plus Pro monthly, annual, and lifetime in-app purchases for alerts, board recommendations, and offline mode.",
  },
  {
    label: "Surfline upgrade page",
    href: "https://www.surfline.com/upgrade",
    note:
      "Premium and Premium+ plan positioning, 16-day forecasts, live cams, and annual pricing.",
  },
  {
    label: "Surfline free vs Premium support",
    href:
      "https://support.surfline.com/hc/en-us/articles/32996023385243-What-do-I-get-as-a-free-vs-Premium-user",
    note:
      "Free, Premium, Premium with Ads, and Premium+ feature differences.",
  },
  {
    label: "LazySurfer vs Quiver comparison",
    href: "https://lazysurfer.app/compare/quiver.html",
    note:
      "LazySurfer pricing, cross-platform availability, and personalization framing.",
  },
  {
    label: "Surf-Forecast.com app page",
    href: "https://www.surf-forecast.com/pages/app-store",
    note:
      "Global spot coverage, maps, alerts, tide timing, hourly forecasts, and 16-day planning.",
  },
  {
    label: "Surf Captain FAQ",
    href: "https://surfcaptain.com/faq",
    note:
      "Free 5-day forecasts with ads and Surf Captain Pro 16-day forecast pricing.",
  },
  {
    label: "Windy surfing guide",
    href: "https://windy.app/guide/mini-guide-to-surfing.html",
    note: "Wind, swell, tide, and map-reading education for surf forecasting.",
  },
  {
    label: "NOAA NDBC",
    href: "https://www.ndbc.noaa.gov/observations.shtml",
    note: "Free buoy observations and historical observations.",
  },
];
