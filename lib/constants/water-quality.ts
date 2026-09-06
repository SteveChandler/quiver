/**
 * Water Quality constants and EPA beach criteria.
 *
 * Based on EPA Recreational Water Quality Criteria (2012):
 * - Enterococcus: recommended indicator for marine/coastal waters
 * - Fecal Coliform: legacy indicator still used by some states
 *
 * @module constants/water-quality
 */

/** EPA Beach Action Value thresholds (CFU/100mL) */
export const EPA_BEACH_CRITERIA = {
  enterococcus: {
    /** Statistical Threshold Value -- single sample maximum (CFU/100mL) */
    stv: 130,
    /** 30-day geometric mean (CFU/100mL) */
    geometricMean: 35,
  },
  fecalColiform: {
    /** Statistical Threshold Value -- single sample maximum (CFU/100mL) */
    stv: 400,
    /** 30-day geometric mean (CFU/100mL) */
    geometricMean: 200,
  },
} as const;

/** Water quality status enum */
export const WQ_STATUS = {
  GOOD: "good",
  ADVISORY: "advisory",
  CLOSURE: "closure",
  UNKNOWN: "unknown",
} as const;

export type WQStatus = (typeof WQ_STATUS)[keyof typeof WQ_STATUS];

/** CEDEN (California Environmental Data Exchange Network) API configuration */
export const CEDEN_CONFIG = {
  /** CKAN datastore_search_sql endpoint */
  baseUrl: "https://data.ca.gov/api/3/action",
  /** 2020-present bacteria monitoring results resource */
  resourceId: "15a63495-8d9f-4a49-b43a-3092ef3106b9",
  /** CEDEN uses "Coliform, Fecal" (not "Fecal Coliform") */
  characteristics: ["Enterococcus", "Coliform, Fecal"] as const,
  matchRadiusM: 5000,
  requestTimeoutMs: 30_000,
  /** Max records per CKAN SQL query */
  queryLimit: 10_000,
} as const;

/** PacIOOS ERDDAP (Hawaii DOH Clean Water Branch) API configuration */
export const PACIOOS_CONFIG = {
  /** ERDDAP tabledap dataset base URL */
  baseUrl: "https://pae-paha.pacioos.hawaii.edu/erddap/tabledap/cwb_water_quality",
  matchRadiusM: 5000,
  requestTimeoutMs: 30_000,
} as const;

/** Display policy: old samples cannot establish current water conditions. */
export function isCurrentWaterQualitySample(sampleDate: unknown, now: number = Date.now()): boolean {
  if (typeof sampleDate !== "string") return false;
  const sampledAt = Date.parse(sampleDate);
  const age = now - sampledAt;
  return Number.isFinite(age) && age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}
