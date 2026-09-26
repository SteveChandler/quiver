import { haversineKm } from "@/lib/climatology/geo";
import {
  describePeakAndQuiet,
  formatKm,
  NOAA_WAVE_HEIGHT_SOURCE,
  SIGNIFICANT_HEIGHT_SENTENCE,
  type SeasonCopy,
} from "@/lib/climatology/season-copy";
import { formatShare, seasonalDirectionMix, threeFootDaysShare } from "@/lib/climatology/season-view";
import type { Sector } from "@/lib/climatology/types";

const southShare = (mix: Record<Sector, number>): string => formatShare(mix.S + mix.SW);
const westShare = (mix: Record<Sector, number>): string => formatShare(mix.W + mix.NW);

const SHARED_BUOY_NOTE =
  "Huntington Beach and Newport share one buoy here, so these numbers can't say which of the two is bigger on a given day.";

export const NEWPORT_BEACH_SEASON_COPY: SeasonCopy = {
  answerHeading: () => "What the San Pedro South buoy says",
  answer: ({ view }) => describePeakAndQuiet(view),
  comparisonHeading: "Huntington and Newport against Dana Point",
  comparison: ({ dataset, view }) => {
    const huntington = dataset.places.find((place) => place.label === "Huntington Beach Pier");
    const doheny = dataset.places.find((place) => place.label === "Doheny State Beach");
    if (!view.comparison || !huntington || !doheny) {
      return [
        "Oceanside Offshore's record didn't pass our coverage check, so this page doesn't compare Dana Point and San Clemente.",
        SHARED_BUOY_NOTE,
      ];
    }

    const [firstYear, lastYear] = view.primary.yearsUsed;
    const intro =
      `San Pedro South is ${formatKm(haversineKm(view.primary, huntington))} from the Huntington Beach Pier and ` +
      `${formatKm(view.primary.distanceKm)} from Newport Pier, so it stands in for both. Oceanside Offshore, ` +
      `${formatKm(haversineKm(view.comparison, doheny))} from Doheny State Beach, stands in for Dana Point and ` +
      `San Clemente. Both records cover ${firstYear}–${lastYear}.`;

    const summerHome = seasonalDirectionMix(dataset, "waves", [6, 7, 8]);
    const summerAway = seasonalDirectionMix(dataset, "comparison-waves", [6, 7, 8]);
    const winterHome = seasonalDirectionMix(dataset, "waves", [12, 1, 2]);
    const winterAway = seasonalDirectionMix(dataset, "comparison-waves", [12, 1, 2]);
    if (!summerHome || !summerAway || !winterHome || !winterAway) return [intro, SHARED_BUOY_NOTE];

    return [
      intro,
      `From June to August, ${southShare(summerHome)} of hours at San Pedro South had swell from the south or southwest, ` +
        `against ${southShare(summerAway)} at Oceanside Offshore. From December to February, swell from the west or ` +
        `northwest made up ${westShare(winterHome)} of hours at San Pedro South and ${westShare(winterAway)} at Oceanside Offshore.`,
      SHARED_BUOY_NOTE,
    ];
  },
  limitsHeading: "Where the buoy and the beach part ways",
  limits: ({ view }) => [
    `${SIGNIFICANT_HEIGHT_SENTENCE} San Pedro South sits ${formatKm(view.primary.distanceKm)} from Newport Pier, and swell changes as it crosses shallower water and bends around headlands on the way in.`,
    "The Wedge, beside the Newport Harbor jetty, gets its shape from swell reflecting off the jetty. No buoy measures that.",
    view.wind
      ? `Wind comes from ${view.wind.name}, ${formatKm(view.wind.distanceKm)} inland from Newport Pier. Wind at the beach can differ from the airport; the useful part is the timing of the afternoon onshore breeze.`
      : "We don't have a wind record we trust near Newport, so wind isn't part of this page's score.",
  ],
  seasonNote: {
    heading: "Why Newport's best days still come in summer",
    chart: {
      primarySectors: ["S", "SW"],
      primaryLabel: "3 ft+ days, mostly south or southwest swell",
      secondarySectors: ["W", "NW"],
      secondaryLabel: "3 ft+ days, mostly west or northwest swell",
    },
    paragraphs: ({ dataset }) => {
      const winterWest = threeFootDaysShare(dataset, ["W", "NW"], [12, 1, 2]);
      const julyWest = threeFootDaysShare(dataset, ["W", "NW"], [7]);
      const summerSouth = threeFootDaysShare(dataset, ["S", "SW"], [5, 6, 7, 8, 9, 10]);
      const winterSouth = threeFootDaysShare(dataset, ["S", "SW"], [12, 1, 2]);
      if (winterWest === null || julyWest === null || summerSouth === null || winterSouth === null || dataset.shoreNormalDeg === null) {
        return [];
      }
      return [
        `The buoy's bigger winter days mostly come from the west. From December to February, ${formatShare(winterWest)} of days had a daytime median of 3 ft or more with swell mainly from the west or northwest. In July it was ${formatShare(julyWest)}.`,
        `Newport's beaches face southwest (${dataset.shoreNormalDeg}°). Surfline's Orange County guide says the county's southerly orientation holds many of its breaks back from November to April, when Ventura and San Diego can run twice the size.`,
        `South swell runs the other way. From May to October, ${formatShare(summerSouth)} of days had 3 ft or more of swell mainly from the south or southwest, against ${formatShare(winterSouth)} from December to February. That is the swell the Wedge needs: it forms when south swell reflects off the harbor jetty.`,
        "So the buoy scores winter almost as high as summer, but the summer south-swell days are the ones Newport is built for.",
      ];
    },
  },
  bestMonthFaq: ({ dataset, view }) => {
    const summerSouth = threeFootDaysShare(dataset, ["S", "SW"], [5, 6, 7, 8, 9, 10]);
    const winterSouth = threeFootDaysShare(dataset, ["S", "SW"], [12, 1, 2]);
    if (summerSouth === null || winterSouth === null || !view.scoreRange) return view.bestMonthFaq;
    return `Summer into fall. The ${view.primary.name} buoy scores every month between ${view.scoreRange.min} and ${view.scoreRange.max}, but from May to October ${formatShare(summerSouth)} of days bring 3 ft or more of south or southwest swell, the direction Newport's beaches face, against ${formatShare(winterSouth)} from December to February.`;
  },
  sources: [
    NOAA_WAVE_HEIGHT_SOURCE,
    { label: "Wikipedia: The Wedge", url: "https://en.wikipedia.org/wiki/The_Wedge_(surfing)" },
    {
      label: "Surfline: Orange County surf guide",
      url: "https://www.surfline.com/travel/united-states/california/orange-county-surfing-and-beaches/5379524",
    },
  ],
};
