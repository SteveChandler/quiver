export const PANE_RATIOS = {
  wave: 0.6,
  wind: 0.25,
  swell: 0.15,
} as const;

export const DARK_THEME = {
  background: "#1a1a2e",
  textColor: "#e2e8f0",
  gridColor: "rgba(255, 255, 255, 0.06)",
  crosshairColor: "rgba(255, 255, 255, 0.3)",
  waveColor: "#4A70D9",
  waveGradientTop: "rgba(74, 112, 217, 0.4)",
  waveGradientBottom: "rgba(74, 112, 217, 0.0)",
  tideColor: "#ffd700",
  swellColor: "#818cf8",
  windOffshoreColor: "#22c55e",
  windOnshoreColor: "#ef4444",
  windCrossColor: "#eab308",
  tooltipBg: "rgba(26, 26, 46, 0.95)",
  tooltipText: "#e2e8f0",
  watermarkColor: "rgba(255, 255, 255, 0.15)",
  mlColor: "#4A70D9",
  nowLineColor: "rgba(255, 255, 255, 0.5)",
  tierGreat: "rgba(34, 197, 94, 0.08)",
  tierGood: "rgba(59, 130, 246, 0.06)",
  tierFair: "rgba(234, 179, 8, 0.06)",
  tierMarginal: "rgba(255, 255, 255, 0.02)",
  nightOverlay: "rgba(0, 0, 0, 0.15)",
} as const;

export const LIGHT_THEME = {
  background: "#ffffff",
  textColor: "#1e293b",
  gridColor: "rgba(0, 0, 0, 0.06)",
  crosshairColor: "rgba(0, 0, 0, 0.3)",
  waveColor: "#0d9488",
  waveGradientTop: "rgba(13, 148, 136, 0.3)",
  waveGradientBottom: "rgba(13, 148, 136, 0.0)",
  tideColor: "#b8860b",
  swellColor: "#6366f1",
  windOffshoreColor: "#16a34a",
  windOnshoreColor: "#dc2626",
  windCrossColor: "#ca8a04",
  tooltipBg: "rgba(255, 255, 255, 0.95)",
  tooltipText: "#1e293b",
  watermarkColor: "rgba(0, 0, 0, 0.1)",
  mlColor: "#4A70D9",
  nowLineColor: "rgba(0, 0, 0, 0.4)",
  tierGreat: "rgba(34, 197, 94, 0.08)",
  tierGood: "rgba(59, 130, 246, 0.06)",
  tierFair: "rgba(234, 179, 8, 0.06)",
  tierMarginal: "rgba(0, 0, 0, 0.02)",
  nightOverlay: "rgba(0, 0, 0, 0.05)",
} as const;

export type ChartTheme = typeof DARK_THEME;

export interface TimeRange {
  label: string;
  hours: number;
  isDefault?: boolean;
}

export const TIME_RANGES: TimeRange[] = [
  { label: "24H", hours: 24 },
  { label: "3D", hours: 72, isDefault: true },
  { label: "7D", hours: 168 },
  { label: "12D", hours: 288 },
];

export const CONDITION_TIER_COLORS = {
  great: {
    dark: "rgba(34, 197, 94, 0.08)",
    light: "rgba(34, 197, 94, 0.08)",
  },
  good: {
    dark: "rgba(59, 130, 246, 0.06)",
    light: "rgba(59, 130, 246, 0.06)",
  },
  fair: {
    dark: "rgba(234, 179, 8, 0.06)",
    light: "rgba(234, 179, 8, 0.06)",
  },
  marginal: {
    dark: "rgba(255, 255, 255, 0.02)",
    light: "rgba(0, 0, 0, 0.02)",
  },
} as const;

export const MIN_CHART_HEIGHT = 400;
export const CHART_PADDING = { top: 8, right: 8, bottom: 0, left: 8 };
