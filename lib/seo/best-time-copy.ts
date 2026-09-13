import type { BestTimeToSurfData } from "@/actions/city/best-time-actions";
import type { IntentForecastSummary } from "@/actions/forecast/intent-forecast-actions";
import type { SeoFunnelNextStep } from "@/components/seo/seo-funnel-next-steps";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { isPhase18BestTimePath } from "@/lib/recommendations/session-intelligence-rollout";

const BEST_TIME_SERP_TITLE_MAX_LENGTH = 60;
const BEST_TIME_SERP_TITLE_SUFFIX = " | Quiver";
const BEST_TIME_META_DESCRIPTION_MAX_LENGTH = 160;

interface BestTimeMetadataCopy {
  title: string;
  description: string;
  h1: string;
}

export function buildBestTimeMetadataCopy(
  cityName: string,
): BestTimeMetadataCopy {
  if (cityName === "La Jolla") {
    return {
      title: "La Jolla Surf Report Today: Tide, Wind & Swell",
      description:
        "La Jolla surf report today: see the best tide and wind window, live wave height and swell, plus current conditions at Shores, Scripps, and Tourmaline.",
      h1: "Best La Jolla surf window today: tide and conditions",
    };
  }

  const detailedTitle = `Best ${cityName} surf window today: tide & wind`;
  const compactTitle = `${cityName} surf window today: tide & wind`;
  const detailedDescription = `${cityName}'s best surf window today: check tide, wind, swell, and live conditions at nearby spots, plus seasonal patterns for planning your next session.`;
  const compactDescription = `${cityName}'s surf window today: check tide, wind, swell, and live spot conditions, plus seasonal patterns for planning your next session.`;

  return {
    title:
      `${detailedTitle}${BEST_TIME_SERP_TITLE_SUFFIX}`.length <=
      BEST_TIME_SERP_TITLE_MAX_LENGTH
        ? detailedTitle
        : compactTitle,
    description:
      detailedDescription.length <= BEST_TIME_META_DESCRIPTION_MAX_LENGTH
        ? detailedDescription
        : compactDescription,
    h1: `Best ${cityName} surf window today: tide and conditions`,
  };
}

interface BestTimeCtrOverride {
  answerPrefix: string;
  weekSuffix: string;
  surfReportCue: string;
  surfReportStep: SeoFunnelNextStep;
}

const BEST_TIME_CTR_OVERRIDES: Record<string, BestTimeCtrOverride> = {
  "la-jolla": {
    answerPrefix:
      "For La Jolla, use Scripps Pier, Shores, and Tourmaline as the live proof points before trusting the seasonal pattern.",
    weekSuffix:
      "If the seasonal guide says yes but Scripps or Shores shows tide or wind trouble, let the live report win.",
    surfReportCue:
      "Open the La Jolla surf report first for the city-level call, then compare Scripps Pier or Tourmaline as secondary spot reads before using this seasonal guide.",
    surfReportStep: {
      label: "Open today's La Jolla surf report",
      href: "/surf-report/la-jolla-today",
      description:
        "Use the city-level La Jolla report to compare Shores, Windansea, and Scripps wave height, wind, tide, and backup notes.",
    },
  },
  "newport-beach": {
    answerPrefix:
      "For Newport Beach, separate the seasonal calendar from the live Blackies and jetty read before you commit.",
    weekSuffix:
      "Use this page for seasonality, but let the Newport Beach surf report own today's tide, wind, and board call.",
    surfReportCue:
      "Start with the Newport Beach surf report for live tide, wind, Blackies context, and North Orange County backups before using this seasonal guide.",
    surfReportStep: {
      label: "Open today's Newport Beach surf report",
      href: "/surf-report/newport-beach-today",
      description:
        "Use the live Newport Beach owner page for Blackies, wind, tide, crowd, and backup checks.",
    },
  },
  malibu: {
    answerPrefix:
      "For Malibu, treat crowd and tide as part of the forecast before the seasonal score makes the call.",
    weekSuffix:
      "The seasonal window matters most when the live Malibu surf report still shows room, clean wind, and the right tide.",
    surfReportCue:
      "Open the Malibu surf report for today's First Point wave height, tide, wind, crowd note, and backup plan before using this seasonal guide.",
    surfReportStep: {
      label: "Open today's Malibu surf report",
      href: "/surf-report/malibu-today",
      description:
        "Use the live Malibu report for First Point tide, wind, crowd, and backup context.",
    },
  },
  "santa-cruz": {
    answerPrefix:
      "For Santa Cruz, separate Steamer Lane's experienced reef setup from smaller Cowell's and Capitola beginner windows; the same swell, tide, and wind do not suit both.",
    weekSuffix:
      "Smaller summer surf can open gentler beginner windows; fall and winter NW swell favors exposed reef and point breaks, but morning wind, tide, and spot fit still decide the session.",
    surfReportCue:
      "Check Steamer Lane's live wind, tide, and swell first. For a beginner plan, use Cowell's or Capitola only when the surf stays small and manageable, and confirm Santa Cruz water temperature before choosing a wetsuit.",
    surfReportStep: {
      label: "Open live Steamer Lane conditions",
      href: "/ca/santa-cruz/steamer-lane-santa-cruz-ca",
      description:
        "Check Steamer Lane's live wave height, wind, tide, and swell before applying the Santa Cruz season guide.",
    },
  },
};

function getBestTimeCtrOverride(citySlug: string): BestTimeCtrOverride | null {
  return BEST_TIME_CTR_OVERRIDES[citySlug] ?? null;
}

type BestTimeHandoffBeach = Pick<
  BestTimeToSurfData["topBeaches"][number],
  "name" | "slug" | "city" | "state" | "country"
>;

export function buildBestTimeLiveHandoffSteps({
  cityName,
  citySlug,
  path,
  stateSlug,
  topBeaches,
}: {
  cityName: string;
  citySlug: string;
  path?: string;
  stateSlug: string;
  topBeaches: BestTimeHandoffBeach[];
}): SeoFunnelNextStep[] {
  const primarySpot = topBeaches.find(
    (beach) => beach.slug && beach.city && beach.state,
  );
  const primarySpotHref = primarySpot
    ? buildBeachUrl(primarySpot)
    : `/${stateSlug}/${citySlug}`;
  const primarySpotName = primarySpot?.name ?? cityName;
  const ctrOverride = getBestTimeCtrOverride(citySlug);

  if (path && isPhase18BestTimePath(path)) {
    const steps = [
      {
        label: `Open live ${primarySpotName} conditions`,
        href: primarySpotHref,
        description:
          "Use the current wave height, wind, tide, and local call before applying the seasonal pattern.",
      },
      {
        label: `Check today's ${cityName} surf hub`,
        href: `/${stateSlug}/${citySlug}`,
        description:
          "Compare live spots in this city before picking the window that fits your plan.",
      },
      {
        label: "Scan the 7-day regional forecast",
        href: "/forecast",
        description:
          "Use the forecast hub to confirm whether this seasonal setup is building or fading.",
      },
    ];

    if (!ctrOverride) return steps;

    return [
      ctrOverride.surfReportStep,
      ...steps.filter((step) => step.href !== ctrOverride.surfReportStep.href),
    ];
  }

  const steps = [
    {
      label: `Check today's ${primarySpotName} surf report`,
      href: primarySpotHref,
      description:
        "Start with the live wave height, wind, tide, and board call before committing.",
    },
    {
      label: `Find the best current ${cityName} window`,
      href: `/${stateSlug}/${citySlug}`,
      description:
        "Compare the city's current forecast and spot list against the seasonal pattern.",
    },
    {
      label: `Compare nearby ${cityName} spots`,
      href: `/map?search=${encodeURIComponent(cityName)}`,
      description:
        "Use the map to switch beaches when crowd, wind, or tide changes the call.",
    },
  ];

  if (!ctrOverride) return steps;

  return [
    ctrOverride.surfReportStep,
    ...steps.filter((step) => step.href !== ctrOverride.surfReportStep.href),
  ];
}

interface BestTimeTodayAnswerCopyArgs {
  citySlug?: string;
  cityName: string;
  currentMonthName: string;
  currentMonthScore: number;
  currentBestMonthCount: number;
  totalBeaches: number;
  peakMonthName: string;
  waveHeightRange?: string | null;
  waterTempF?: number | null;
  forecastSummary?: IntentForecastSummary | null;
}

export function buildBestTimeTodayAnswerCopy({
  citySlug,
  cityName,
  currentMonthName,
  currentMonthScore,
  currentBestMonthCount,
  totalBeaches,
  peakMonthName,
  waveHeightRange,
  waterTempF,
  forecastSummary,
}: BestTimeTodayAnswerCopyArgs): {
  eyebrow: string;
  heading: string;
  weekHeading: string;
  todayAnswer: string;
  thisWeekAnswer: string;
  surfReportCue: string;
} {
  const seasonStrength =
    currentBestMonthCount > 0
      ? `${currentBestMonthCount} of ${totalBeaches} local beaches are in peak season`
      : `${cityName} is between peak-season windows`;
  const seasonalConditions = [
    waveHeightRange ? `${waveHeightRange} surf` : null,
    waterTempF != null ? `${waterTempF}°F water` : null,
  ].filter((condition): condition is string => condition !== null);
  const seasonalContext = seasonalConditions.length > 0
    ? ` Seasonal context: ${seasonalConditions.join(" and ")}.`
    : "";
  const forecastDay = forecastSummary?.isTomorrow ? "tomorrow" : "today";
  const topPick = forecastSummary?.topPicks[0];
  const liveTodayAnswer =
    forecastSummary?.bestWindow
      ? `${cityName}'s best surf window ${forecastDay} is ${forecastSummary.bestWindow.start}-${forecastSummary.bestWindow.end}, with ${forecastSummary.conditions.tide.toLowerCase()} tide, ${forecastSummary.conditions.wind} wind, and ${forecastSummary.conditions.swell} swell; ${forecastSummary.bestWindow.reason}. ${
          topPick
            ? `${topPick.name} is the top pick at ${topPick.waveHeight}.`
            : "Check the live report before you drive."
        }`
      : null;
  const liveSurfReportCue = forecastSummary
    ? `${forecastSummary.conditions.tide} tide, ${forecastSummary.conditions.wind} wind, and ${forecastSummary.conditions.swell} swell are the live surf report cues to confirm first.`
    : null;
  const ctrOverride = citySlug ? getBestTimeCtrOverride(citySlug) : null;
  const baseTodayAnswer =
    liveTodayAnswer ??
    `${cityName}'s best surf window today starts with the live report: check tide, wind, and swell before you drive.${seasonalContext}`;
  const baseThisWeekAnswer = `${currentMonthName} rates ${currentMonthScore}/100 for ${cityName}. ${seasonStrength}; ${peakMonthName} is the historical peak if this week's surf report looks marginal.`;

  return {
    eyebrow: "Live surf planning",
    heading: `Best time to surf ${cityName} today`,
    weekHeading: `Best time to surf ${cityName} this week`,
    todayAnswer: ctrOverride
      ? `${baseTodayAnswer} ${ctrOverride.answerPrefix}`
      : baseTodayAnswer,
    thisWeekAnswer: ctrOverride
      ? `${baseThisWeekAnswer} ${ctrOverride.weekSuffix}`
      : baseThisWeekAnswer,
    surfReportCue:
      ctrOverride?.surfReportCue ??
      liveSurfReportCue ??
      `Use the surf report first, then treat this seasonal guide as the tiebreaker for which ${cityName} spot and window to choose.`,
  };
}
