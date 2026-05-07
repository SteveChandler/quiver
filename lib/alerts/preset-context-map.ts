/**
 * Maps page context to recommended alert presets with contextual copy.
 * Used by AlertCaptureCta to show relevant presets as signup motivators.
 */

export type AlertPageContext =
  | "beach-detail"
  | "tides"
  | "water-temp"
  | "beginner"
  | "longboard"
  | "dawn-patrol"
  | "sunset"
  | "least-crowded"
  | "city-surf-report";

export interface ContextualPresetConfig {
  /** Preset type keys (references PresetType without importing to avoid circular deps) */
  presets: string[];
  headline: (name: string) => string;
  description: (name: string) => string;
  buttonText: string;
}

const CONTEXT_MAP: Record<AlertPageContext, ContextualPresetConfig> = {
  tides: {
    presets: ["tide_window", "glass_off"],
    headline: (name) => `Get alerted when conditions align at ${name}`,
    description: (name) =>
      `We'll notify you when optimal tide windows open at ${name} — no chart-checking required.`,
    buttonText: "Set Up Tide Alerts — Free",
  },
  "water-temp": {
    presets: ["dawn_patrol"],
    headline: (name) => `Get water temp and surf-window alerts for ${name}`,
    description: (name) =>
      `Track water temperature, gear calls, and clean windows at ${name} without checking three pages.`,
    buttonText: "Get Water Temp Alerts",
  },
  beginner: {
    presets: ["mellow_session"],
    headline: (name) => `Get alerted when beginner-friendly conditions hit ${name}`,
    description: (name) =>
      `Small, clean, and fun — we'll let you know when ${name} is mellow enough for learning.`,
    buttonText: "Get Mellow Session Alerts — Free",
  },
  longboard: {
    presets: ["mellow_session", "glass_off"],
    headline: (name) => `Get alerted when it's glassy at ${name}`,
    description: (name) =>
      `Smooth, clean waves perfect for logging. We'll ping you when ${name} goes glass.`,
    buttonText: "Get Longboard Alerts — Free",
  },
  "dawn-patrol": {
    presets: ["dawn_patrol"],
    headline: (name) => `Dawn patrol alerts for ${name}`,
    description: (name) =>
      `Get a heads-up before first light when ${name} has rideable waves — skip the guesswork.`,
    buttonText: "Set Up Dawn Patrol Alerts — Free",
  },
  sunset: {
    presets: ["glass_off"],
    headline: (name) => `Evening session alerts for ${name}`,
    description: (name) =>
      `Wind dies, glass appears. We'll let you know when ${name} cleans up for golden hour.`,
    buttonText: "Get Evening Alerts — Free",
  },
  "least-crowded": {
    presets: ["dawn_patrol", "tide_window"],
    headline: (name) => `Get tipped off when ${name} is empty`,
    description: (name) =>
      `Dawn patrol windows and off-peak tides — the best times to score ${name} with fewer people.`,
    buttonText: "Get Crowd-Beating Alerts — Free",
  },
  "beach-detail": {
    presets: ["glass_off", "dawn_patrol"],
    headline: (name) => `Never miss a good day at ${name}`,
    description: (name) =>
      `Set up conditions alerts and we'll let you know when ${name} is firing.`,
    buttonText: "Get Alerts — Free",
  },
  "city-surf-report": {
    presets: ["glass_off", "dawn_patrol", "mellow_session"],
    headline: (name) => `Get daily condition alerts for ${name}`,
    description: (name) =>
      `Know when it's worth paddling out. Alerts tuned to your favorite conditions at ${name}.`,
    buttonText: "Get Condition Alerts — Free",
  },
};

export function getContextualPresetConfig(
  context: AlertPageContext,
): ContextualPresetConfig {
  return CONTEXT_MAP[context];
}
