import type {
  AlertConditions,
  BeachAlertMeta,
  PresetDefinition,
  PresetType,
} from "./types";

export const PRESETS: PresetDefinition[] = [
  {
    type: "glass_off",
    name: "Glassy",
    description: "Light wind and clean waves — smooth as glass",
    conditionsSummary: "Offshore or <5kt wind, 2ft+ swell",
    group: "popular",
    buildConditions: (): AlertConditions => ({
      wind_direction: "offshore",
      wind_speed_max_kt: 5,
      swell_height_min: 2,
    }),
  },
  {
    type: "mellow_session",
    name: "Mellow Session",
    description: "Small, clean, and fun — great for longboarding or learning",
    conditionsSummary: "1.5-4ft swell, <8kt wind, favorable tide",
    group: "popular",
    buildConditions: (beach: BeachAlertMeta): AlertConditions => ({
      swell_height_min: 1.5,
      swell_height_max: 4,
      wind_speed_max_kt: 8,
      tide_height_min_ft: beach.preferred_tide_ft_min ?? undefined,
      tide_height_max_ft: beach.preferred_tide_ft_max ?? undefined,
    }),
  },
  {
    type: "dawn_patrol",
    name: "Dawn Patrol",
    description: "Anything rideable at first light — for the daily surfer",
    conditionsSummary: "1.5ft+ swell, <15kt wind, first 2 hours",
    group: "popular",
    buildConditions: (): AlertConditions => ({
      swell_height_min: 1.5,
      wind_speed_max_kt: 15,
    }),
  },
  {
    type: "big_day",
    name: "Big Day",
    description: "Large swell incoming — for experienced surfers chasing size",
    conditionsSummary: "6ft+ swell, 10s+ period",
    group: "specific",
    buildConditions: (): AlertConditions => ({
      swell_height_min: 6,
      swell_period_min: 10,
    }),
  },
  {
    type: "clean_groundswell",
    name: "Clean Groundswell",
    description:
      "Long-period swell with clean conditions — quality over quantity",
    conditionsSummary: "2ft+ swell, 12s+ period, <10kt wind, favorable direction",
    group: "specific",
    buildConditions: (beach: BeachAlertMeta): AlertConditions => ({
      swell_height_min: 2,
      swell_period_min: 12,
      wind_speed_max_kt: 10,
      swell_direction_min_deg:
        beach.swell_window_center_deg != null &&
        beach.swell_window_halfwidth_deg != null
          ? (beach.swell_window_center_deg -
              beach.swell_window_halfwidth_deg +
              360) %
            360
          : undefined,
      swell_direction_max_deg:
        beach.swell_window_center_deg != null &&
        beach.swell_window_halfwidth_deg != null
          ? (beach.swell_window_center_deg + beach.swell_window_halfwidth_deg) %
            360
          : undefined,
    }),
  },
  {
    type: "tide_window",
    name: "Tide Window",
    description: "Optimal tide for this spot — great for reef breaks",
    conditionsSummary: "Tide in spot's preferred range and direction",
    group: "specific",
    buildConditions: (beach: BeachAlertMeta): AlertConditions => ({
      tide_height_min_ft: beach.preferred_tide_ft_min ?? undefined,
      tide_height_max_ft: beach.preferred_tide_ft_max ?? undefined,
      tide_direction:
        (beach.preferred_tide_direction as AlertConditions["tide_direction"]) ??
        undefined,
    }),
  },
  {
    type: "epic_conditions",
    name: "Epic Conditions",
    description: "Everything aligns — the rare days you don't want to miss",
    conditionsSummary: "All conditions in spot's ideal ranges",
    group: "specific",
    buildConditions: (beach: BeachAlertMeta): AlertConditions => ({
      wind_direction: "offshore",
      wind_speed_max_kt: 10,
      swell_height_min: 3,
      swell_period_min: 10,
      tide_height_min_ft: beach.preferred_tide_ft_min ?? undefined,
      tide_height_max_ft: beach.preferred_tide_ft_max ?? undefined,
      swell_direction_min_deg:
        beach.swell_window_center_deg != null &&
        beach.swell_window_halfwidth_deg != null
          ? (beach.swell_window_center_deg -
              beach.swell_window_halfwidth_deg +
              360) %
            360
          : undefined,
      swell_direction_max_deg:
        beach.swell_window_center_deg != null &&
        beach.swell_window_halfwidth_deg != null
          ? (beach.swell_window_center_deg + beach.swell_window_halfwidth_deg) %
            360
          : undefined,
    }),
  },
  {
    type: "daily_check_in",
    name: "Daily check-in",
    description:
      "Validation preset — intentionally loose so it fires on most days at most beaches. " +
      "Used to prove the alert delivery chain end-to-end during Phase-1 rollout. Not " +
      "intended for general user creation.",
    conditionsSummary: "Any rideable surf with non-storm winds",
    group: "specific",
    buildConditions: (): AlertConditions => ({
      swell_height_min: 0.5,
      wind_speed_max_kt: 25,
    }),
  },
];

export function getPreset(type: PresetType): PresetDefinition | undefined {
  return PRESETS.find((p) => p.type === type);
}

export function getPresetsForGroup(
  group: "popular" | "specific"
): PresetDefinition[] {
  return PRESETS.filter((p) => p.group === group);
}
