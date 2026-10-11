import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";

export interface ComparisonSourceLink {
  label: string;
  href: string;
  note: string;
}

export const COMPARISON_SOURCE_REVIEW = {
  lastVerified: "2026-10-11",
  reviewedBy: "Quiver editorial team",
  // Pricing and product features change often enough to warrant review every two months.
  freshnessThresholdDays: 60,
} as const;

export const COMPARISON_SOURCE_LINKS: readonly ComparisonSourceLink[] = [
  {
    label: "Quiver App Store listing",
    href: `${IOS_APP_STORE_WEB_REDIRECT_PATH}&source=best_surf_forecast_app&surface=comparison&placement=source_link`,
    note:
      "Quiver iPhone listing: free download; Pro in-app purchases $4.99 monthly, $39.99 annual, and $119.99 lifetime. Pro features include similarity alerts, board recommendations, and offline mode.",
  },
  {
    label: "Surfline App Store listing",
    href: "https://apps.apple.com/us/app/surfline-wave-surf-reports/id393782096",
    note:
      "Free download; Premium in-app purchases $15.99 monthly and $119.99 annual, Premium+ $149.99 annual. Also on Android and the web.",
  },
  {
    label: "Surfline free vs Premium support",
    href:
      "https://support.surfline.com/hc/en-us/articles/32996023385243-What-do-I-get-as-a-free-vs-Premium-user",
    note:
      "Free, Premium, Premium with Ads, and Premium+ feature differences.",
  },
  {
    label: "Lazy Surfer App Store listing",
    href: "https://apps.apple.com/us/app/lazy-surfer/id1450887020",
    note:
      "Free download with Pro in-app purchases from $4.99; session logging and personalized forecasts. Also on Google Play.",
  },
  {
    label: "Swell Scope App Store listing",
    href: "https://apps.apple.com/us/app/swell-scope-surf-forecast/id6747609653",
    note:
      "Free download with in-app purchases of $2.99, $24.99, and $49.99; user-defined spots with exposure settings and a surf journal. Also on Google Play.",
  },
  {
    label: "Surf-Forecast.com App Store listing",
    href: "https://apps.apple.com/us/app/surf-forecast-com/id6450721636",
    note:
      "Free download; Premium in-app purchases $4.99 monthly and $34.99 annual. Global spot coverage, maps, alerts, and long-range planning.",
  },
  {
    label: "Surf Captain FAQ",
    href: "https://surfcaptain.com/faq",
    note:
      "Basic users get a 5-day forecast with ads; Surf Captain Pro is $19.99 per year for 16-day forecasts.",
  },
  {
    label: "Windy.app App Store listing",
    href: "https://apps.apple.com/us/app/windy-app-wind-tides-radar/id997079492",
    note:
      "Free wind, wave, and tide maps; paid plans are sold as in-app purchases. Also on Android.",
  },
  {
    label: "NOAA NDBC",
    href: "https://www.ndbc.noaa.gov/observations.shtml",
    note: "Free buoy observations and historical observations.",
  },
];
