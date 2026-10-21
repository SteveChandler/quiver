import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";

export interface ComparisonSourceLink {
  label: string;
  href: string;
  note: string;
  /** Renders as a tracked install CTA; `href` stays for the source checker. */
  installCta?: { source: string; surface: string; placement: string };
}

export const COMPARISON_SOURCE_REVIEW = {
  lastVerified: "2026-10-11",
  reviewedBy: "Quiver editorial team",
  // Pricing and product features change often enough to warrant review every two months.
  freshnessThresholdDays: 60,
} as const;

// Quiver's own facts and the public data behind its forecasts only: this page
// does not name or link to other surf apps (Steven, 2026-10-11).
export const COMPARISON_SOURCE_LINKS: readonly ComparisonSourceLink[] = [
  {
    label: "Quiver App Store listing",
    href: `${IOS_APP_STORE_WEB_REDIRECT_PATH}&source=best_surf_forecast_app&surface=comparison&placement=source_link`,
    installCta: {
      source: "best_surf_forecast_app",
      surface: "comparison",
      placement: "source_link",
    },
    note:
      "Quiver iPhone listing: free download; Pro in-app purchases $4.99 monthly, $39.99 annual, and $119.99 lifetime. Pro features include similarity alerts, board recommendations, and offline mode.",
  },
  {
    label: "NOAA NDBC",
    href: "https://www.ndbc.noaa.gov/observations.shtml",
    note: "Free buoy observations and historical observations.",
  },
  {
    label: "CDIP buoy network",
    href: "https://cdip.ucsd.edu/",
    note: "Coastal wave buoys used for swell observations where one is close enough to a break.",
  },
];
