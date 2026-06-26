export type HowTheCallWorksFactorId =
  | "buoy"
  | "wind"
  | "tide"
  | "terrain"
  | "skill"
  | "verdict";

export type MapFieldGuideFactorId = "buoy" | "wind" | "tide";

export interface HowTheCallWorksMetric {
  label: string;
  value: string;
  helper: string;
}

export interface MapFieldGuideContent {
  headline: string;
  body: string;
  call: string;
  mapCue: string;
  metrics: readonly HowTheCallWorksMetric[];
}

export interface HowTheCallWorksFactor {
  id: HowTheCallWorksFactorId;
  label: string;
  shortLabel: string;
  explainerLabel: string;
  description: string;
  mapLearning?: MapFieldGuideContent;
}

export interface MapFieldGuideFactor extends HowTheCallWorksFactor {
  id: MapFieldGuideFactorId;
  mapLearning: MapFieldGuideContent;
}

export const HOW_THE_CALL_WORKS_FACTORS: readonly HowTheCallWorksFactor[] = [
  {
    id: "buoy",
    label: "Buoy read",
    shortLabel: "Buoy",
    explainerLabel: "Buoy / swell",
    description:
      "Buoys show the raw swell moving through the water. Period tells you how much push it has; direction tells you whether that energy can reach the beach.",
    mapLearning: {
      headline: "Start with the buoy before trusting the spot number.",
      body: "Buoys show the raw swell moving through the water. Period tells you how much push it has; direction tells you whether that energy can reach the beach.",
      call: "Long-period swell with a direction that fits the beach gets upgraded. Short-period local wind swell gets checked against the map before you drive.",
      mapCue:
        "Tap swell field on the map, then compare the bright bands to nearby beach markers.",
      metrics: [
        {
          label: "Height",
          value: "3 ft",
          helper: "Raw energy, not always face height at the break.",
        },
        {
          label: "Period",
          value: "13 sec",
          helper: "More seconds means more push and more refraction.",
        },
        {
          label: "Direction",
          value: "WSW",
          helper: "Only useful if the beach is exposed to that angle.",
        },
      ],
    },
  },
  {
    id: "wind",
    label: "Wind read",
    shortLabel: "Wind",
    explainerLabel: "Wind",
    description:
      "Offshore or light side-shore wind can groom the wave. Onshore wind adds bump, crumble, and drift even when the swell number looks fine.",
    mapLearning: {
      headline: "Wind decides whether the swell has a clean face.",
      body: "Offshore or light side-shore wind can groom the wave. Onshore wind adds bump, crumble, and drift even when the swell number looks fine.",
      call: "Upgrade light offshore mornings. Downgrade afternoon onshore flow unless the spot has cliffs, kelp, or angle protection.",
      mapCue:
        "Use the map to compare nearby beaches. A protected cove can stay cleaner than an exposed beach on the same swell.",
      metrics: [
        {
          label: "Direction",
          value: "E",
          helper: "Offshore at many west-facing California beaches.",
        },
        {
          label: "Speed",
          value: "6 kt",
          helper: "Light enough to keep texture controlled.",
        },
        {
          label: "Trend",
          value: "Rising",
          helper: "A good dawn window can close fast.",
        },
      ],
    },
  },
  {
    id: "tide",
    label: "Tide read",
    shortLabel: "Tide",
    explainerLabel: "Tide",
    description:
      "The same swell can be fun, drained, or swamped depending on water level. The best call is usually a tide window, not an all-day rating.",
    mapLearning: {
      headline: "Tide turns a forecast into a time window.",
      body: "The same swell can be fun, drained, or swamped depending on water level. The best call is usually a tide window, not an all-day rating.",
      call: "Look for the spot's working range and the direction of change. Incoming tide can help soft sandbars; too much high tide can bury them.",
      mapCue:
        "Search a spot, then use the field guide to compare tide timing with the closest forecast window.",
      metrics: [
        {
          label: "Now",
          value: "2.4 ft",
          helper: "Current water level sets the baseline.",
        },
        {
          label: "Next",
          value: "Rising",
          helper: "Direction of movement often matters more than exact height.",
        },
        {
          label: "Window",
          value: "Dawn",
          helper: "Pair the tide change with the cleanest wind.",
        },
      ],
    },
  },
  {
    id: "terrain",
    label: "Terrain read",
    shortLabel: "Terrain",
    explainerLabel: "Terrain",
    description:
      "A protected cove can stay cleaner than an exposed beach on the same swell.",
  },
  {
    id: "skill",
    label: "Skill read",
    shortLabel: "Skill",
    explainerLabel: "Your skill",
    description:
      "Your board, comfort level, and preferred pace decide whether a window is friendly, punchy, or better for advanced surfers.",
  },
  {
    id: "verdict",
    label: "Verdict",
    shortLabel: "Verdict",
    explainerLabel: "The verdict",
    description:
      "Quiver rolls those signals into YES, MAYBE, or NO so you know whether the marker deserves the drive.",
  },
];

export const MAP_FIELD_GUIDE_FACTORS: readonly MapFieldGuideFactor[] =
  HOW_THE_CALL_WORKS_FACTORS.filter(
    (factor): factor is MapFieldGuideFactor =>
      factor.id === "buoy" || factor.id === "wind" || factor.id === "tide"
  );
