import type {
  AlertConditions,
  BeachAlertMeta,
  PresetDefinition,
  PresetType,
} from "./types";
import { getSandyBeginnerWindowProfile } from "@/lib/beginner/beginner-window-evaluator";

const MPH_TO_KT = 0.868976;

function buildMellowSessionConditions(beach: BeachAlertMeta): AlertConditions {
  const beginnerProfile = getSandyBeginnerWindowProfile(beach);

  if (!beginnerProfile) {
    return {
      swell_height_min: 1.5,
      swell_height_max: 4,
      wind_speed_max_kt: 8,
      tide_height_min_ft: beach.preferred_tide_ft_min ?? undefined,
      tide_height_max_ft: beach.preferred_tide_ft_max ?? undefined,
    };
  }

  return {
    swell_height_min: beginnerProfile.acceptableWaveHeightFt.min,
    swell_height_max: beginnerProfile.acceptableWaveHeightFt.max,
    wind_speed_max_kt: Math.round(
      beginnerProfile.maxBeginnerWindMph * MPH_TO_KT,
    ),
    tide_height_min_ft: beginnerProfile.preferredTideFt.min ?? undefined,
    tide_height_max_ft: beginnerProfile.preferredTideFt.max ?? undefined,
    avoid_tide_statuses: ["high"],
    local_time_start: beginnerProfile.bestTimeLocal.start,
    local_time_end: beginnerProfile.bestTimeLocal.end,
    beginner_sandy_window: true,
  };
}

export const PRESETS: PresetDefinition[] = [
  {
    type: "glass_off",
    name: "Glassy",
    description: "Light wind and clean waves. Smooth as glass.",
    conditionsSummary: "Offshore or under 5 kt wind, 2 ft plus swell",
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
    description: "Small, clean, and fun. Good for longboards and learning.",
    conditionsSummary: "1.5 to 4 ft swell, under 8 kt wind, favorable tide",
    group: "popular",
    buildConditions: buildMellowSessionConditions,
  },
  {
    type: "dawn_patrol",
    name: "Dawn Patrol",
    description: "Rideable surf at first light for the daily surfer.",
    conditionsSummary:
      "1.5 ft plus swell, under 8 kt wind, first light (5-9 AM)",
    group: "popular",
    buildConditions: (): AlertConditions => ({
      swell_height_min: 1.5,
      wind_speed_max_kt: 8,
      local_time_start: "05:00",
      local_time_end: "09:00",
    }),
  },
  {
    type: "weekend_warrior",
    name: "Weekend Warrior",
    description: "Saturday and Sunday only. For the surfer on a work schedule.",
    conditionsSummary: "2 ft plus swell, under 12 kt wind, weekends only",
    group: "popular",
    buildConditions: (): AlertConditions => ({
      swell_height_min: 2,
      wind_speed_max_kt: 12,
      days_of_week: [0, 6],
    }),
  },
  {
    type: "after_work",
    name: "After Work",
    description: "Evening glass-off sessions when the day cooperates.",
    conditionsSummary: "2 ft plus swell, under 10 kt wind, 4-8 PM",
    group: "popular",
    buildConditions: (): AlertConditions => ({
      swell_height_min: 2,
      wind_speed_max_kt: 10,
      local_time_start: "16:00",
      local_time_end: "20:00",
    }),
  },
  {
    type: "big_day",
    name: "Big Day",
    description: "Large swell for experienced surfers chasing size.",
    conditionsSummary: "6 ft plus swell, 10 s plus period",
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
      "Long period swell with clean conditions. Quality over quantity.",
    conditionsSummary:
      "2 ft plus swell, 12 s plus period, under 10 kt wind, favorable direction",
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
    description: "Optimal tide for this spot. Good for reef breaks.",
    conditionsSummary: "Spot's preferred tide range, preferred tide direction",
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
    description:
      "Everything lines up for the rare days worth dropping everything.",
    conditionsSummary: "Ideal wind, ideal swell, ideal tide",
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
    name: "Daily check in",
    description:
      "Validation preset intentionally loose so it fires on most days at most beaches. " +
      "Used to prove the alert delivery chain during Phase 1 rollout. Not " +
      "intended for general user creation.",
    conditionsSummary: "Rideable surf, non storm winds",
    group: "internal",
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
  group: "popular" | "specific",
): PresetDefinition[] {
  return PRESETS.filter((p) => p.group === group);
}
