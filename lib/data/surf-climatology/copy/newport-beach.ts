import { haversineKm } from "@/lib/climatology/geo";
import {
  describePeakAndQuiet,
  formatKm,
  NOAA_WAVE_HEIGHT_SOURCE,
  SIGNIFICANT_HEIGHT_SENTENCE,
  type SeasonCopy,
} from "@/lib/climatology/season-copy";
import { formatShare, seasonalDirectionMix, seasonalLongPeriodShare, threeFootDaysShare } from "@/lib/climatology/season-view";
import { LONG_PERIOD_S, THREE_FOOT_DAY_FT } from "@/lib/climatology/stats";
import type { Sector, SurfClimatologyDataset } from "@/lib/climatology/types";

const southShare = (mix: Record<Sector, number>): string => formatShare(mix.S + mix.SW);
const westShare = (mix: Record<Sector, number>): string => formatShare(mix.W + mix.NW);

const SHARED_BUOY_NOTE =
  "Huntington Beach and Newport share one buoy here, so these numbers can't say which of the two is bigger on a given day.";

interface SouthSwellShares {
  summerSouth: number;
  winterSouth: number;
}

/** Share of 3 ft+ days from the south/southwest in summer-into-fall vs. winter. Shared by seasonNote and bestMonthFaq. */
function southSwellShares(dataset: SurfClimatologyDataset): SouthSwellShares | null {
  const summerSouth = threeFootDaysShare(dataset, ["S", "SW"], [5, 6, 7, 8, 9, 10]);
  const winterSouth = threeFootDaysShare(dataset, ["S", "SW"], [12, 1, 2]);
  if (summerSouth === null || winterSouth === null) return null;
  return { summerSouth, winterSouth };
}

export const NEWPORT_BEACH_SEASON_COPY: SeasonCopy = {
  answerHeading: () => "Newport's year on the San Pedro South buoy",
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

    const directionParagraph =
      `From June to August, ${southShare(summerHome)} of hours at San Pedro South had swell from the south or southwest, ` +
      `against ${southShare(summerAway)} at Oceanside Offshore. From December to February, swell from the west or ` +
      `northwest made up ${westShare(winterHome)} of hours at San Pedro South and ${westShare(winterAway)} at Oceanside Offshore.`;

    const summerLongPeriodHome = seasonalLongPeriodShare(dataset, "waves", [6, 7, 8]);
    const summerLongPeriodAway = seasonalLongPeriodShare(dataset, "comparison-waves", [6, 7, 8]);
    const periodParagraph =
      summerLongPeriodHome !== null && summerLongPeriodAway !== null
        ? [
            `From June to August, ${formatShare(summerLongPeriodHome)} of hours at San Pedro South carried swell of ${LONG_PERIOD_S} seconds ` +
              `or longer, against ${formatShare(summerLongPeriodAway)} at Oceanside Offshore.`,
          ]
        : [];

    return [intro, directionParagraph, ...periodParagraph, SHARED_BUOY_NOTE];
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
      primaryLabel: `${THREE_FOOT_DAY_FT} ft+ days, mostly south or southwest swell`,
      secondarySectors: ["W", "NW"],
      secondaryLabel: `${THREE_FOOT_DAY_FT} ft+ days, mostly west or northwest swell`,
    },
    paragraphs: ({ dataset }) => {
      const winterWest = threeFootDaysShare(dataset, ["W", "NW"], [12, 1, 2]);
      const julyWest = threeFootDaysShare(dataset, ["W", "NW"], [7]);
      const southShares = southSwellShares(dataset);
      if (winterWest === null || julyWest === null || southShares === null || dataset.shoreNormalDeg === null) {
        return [];
      }
      const { summerSouth, winterSouth } = southShares;
      return [
        `The buoy's bigger winter days mostly come from the west. From December to February, ${formatShare(winterWest)} of days had a daytime median of ${THREE_FOOT_DAY_FT} ft or more with swell mainly from the west or northwest. In July it was ${formatShare(julyWest)}.`,
        `South swell runs the other way. From May to October, ${formatShare(summerSouth)} of days had ${THREE_FOOT_DAY_FT} ft or more of swell mainly from the south or southwest, against ${formatShare(winterSouth)} from December to February. Newport's beaches face southwest (${dataset.shoreNormalDeg}°), and the Wedge needs that south swell: it forms when south swell reflects off the harbor jetty.`,
        "So the buoy scores winter almost as high as summer, but the summer south-swell days are the ones Newport is built for.",
      ];
    },
  },
  bestMonthFaq: ({ dataset, view }) => {
    const southShares = southSwellShares(dataset);
    if (southShares === null || !view.scoreRange) return view.bestMonthFaq;
    const { summerSouth, winterSouth } = southShares;
    return `Summer into fall. The ${view.primary.name} buoy scores every month between ${view.scoreRange.min} and ${view.scoreRange.max}, but from May to October ${formatShare(summerSouth)} of days bring ${THREE_FOOT_DAY_FT} ft or more of south or southwest swell, the direction Newport's beaches face, against ${formatShare(winterSouth)} from December to February.`;
  },
  sources: [
    NOAA_WAVE_HEIGHT_SOURCE,
    { label: "Wikipedia: The Wedge", url: "https://en.wikipedia.org/wiki/The_Wedge_(surfing)" },
  ],
};
