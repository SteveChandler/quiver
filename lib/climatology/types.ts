export const SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Sector = (typeof SECTORS)[number];

export type ClimatologyRole = "waves" | "comparison-waves" | "wind";
export type SourceKind = "ndbc" | "iem-asos";
export type GateResult = "passed" | "failed";
export type WindClass = "offshore" | "cross" | "onshore" | "light";

/** One UTC hour at one station. Null means missing or flagged by the source. */
export interface HourlyObservation {
  hourUtcMs: number;
  waveHeightM: number | null;
  dominantPeriodS: number | null;
  meanWaveDirDeg: number | null;
  waterTempC: number | null;
  windDirDeg: number | null;
  windSpeedKt: number | null;
}

export interface LocalHourObservation extends HourlyObservation {
  year: number;
  /** 1-12 in the city's time zone */
  month: number;
  day: number;
  /** 0-23 in the city's time zone */
  hour: number;
}

export interface WaveMonthStats {
  hsFt: { median: number; p25: number; p75: number; p90: number };
  smallDayShare: number;
  bigDayShare: number;
  periodMix: { under8: number; from8to10: number; atLeast10: number };
  directionMix: Record<Sector, number>;
  yearlyMedianFt: Array<{ year: number; medianFt: number }>;
  observedDays: number;
  validHours: number;
  stationMonths: number;
}

export interface WaterMonthStats {
  medianF: number;
  p10F: number;
  p90F: number;
  validHours: number;
}

export interface WindBlockStats {
  offshore: number;
  cross: number;
  onshore: number;
  light: number;
  medianKt: number;
  hours: number;
}

export interface WindMonthStats {
  dawn: WindBlockStats;
  midday: WindBlockStats;
  afternoon: WindBlockStats;
  cleanMorningShare: number;
  observedMornings: number;
}

export interface ClimatologyPlace {
  label: string;
  lat: number;
  lon: number;
}

export interface ClimatologyStation {
  id: string;
  alias: string | null;
  name: string;
  role: ClimatologyRole;
  kind: SourceKind;
  lat: number;
  lon: number;
  distanceKm: number;
  referenceLabel: string;
  yearsUsed: [number, number];
  pageUrl: string;
  gate: GateResult;
  gateCoverage: number;
  validHours: number;
  excludedStationMonths: string[];
}

export interface ClimatologyMonth {
  month: number;
  waves: WaveMonthStats | null;
  comparisonWaves: WaveMonthStats | null;
  water: WaterMonthStats | null;
  wind: WindMonthStats | null;
  score: number | null;
}

export interface SurfClimatologyDataset {
  schemaVersion: 1;
  scoreVersion: "buoy-v1";
  citySlug: string;
  cityName: string;
  generatedAt: string;
  timezone: string;
  shoreNormalDeg: number | null;
  reference: ClimatologyPlace;
  places: ClimatologyPlace[];
  stations: ClimatologyStation[];
  months: ClimatologyMonth[];
}
