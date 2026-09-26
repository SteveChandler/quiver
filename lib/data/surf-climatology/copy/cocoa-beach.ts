import { haversineKm } from "@/lib/climatology/geo";
import {
  describePeakAndQuiet,
  formatKm,
  NOAA_WAVE_HEIGHT_SOURCE,
  SIGNIFICANT_HEIGHT_SENTENCE,
  type SeasonCopy,
} from "@/lib/climatology/season-copy";

export const COCOA_BEACH_SEASON_COPY: SeasonCopy = {
  answerHeading: ({ view }) =>
    `What ${view.primary.yearsUsed[1] - view.primary.yearsUsed[0] + 1} years of the Cape Canaveral buoy show`,
  answer: ({ view }) => describePeakAndQuiet(view),
  comparisonHeading: "Satellite Beach on the same buoy",
  comparison: ({ dataset, view }) => {
    const satellite = dataset.places.find((place) => place.label === "Satellite Beach");
    if (!satellite) return [];
    return [
      `Satellite Beach is ${formatKm(haversineKm(view.primary, satellite))} from the ${view.primary.name} buoy; the Cocoa Beach Pier is ${formatKm(view.primary.distanceKm)} from it. The monthly numbers on this page stand for both beaches.`,
      "They can't tell you which beach is bigger on a given morning. That comes down to the sandbars in front of each one.",
    ];
  },
  limitsHeading: "What the buoy can't tell you about the pier",
  limits: ({ view }) => [
    `${SIGNIFICANT_HEIGHT_SENTENCE} It measures the swell ${formatKm(view.primary.distanceKm)} from the pier, before that swell reaches the sandbars.`,
    "Surf at the pier depends on those bars, and they move after big swells, so the same swell on the buoy can break differently from one month to the next.",
    view.wind
      ? `Wind comes from ${view.wind.name} at Port Canaveral, ${formatKm(view.wind.distanceKm)} from the Cocoa Beach Pier.`
      : "We don't have a wind record we trust near the pier, so wind isn't part of this page's score.",
  ],
  sources: [NOAA_WAVE_HEIGHT_SOURCE],
};
